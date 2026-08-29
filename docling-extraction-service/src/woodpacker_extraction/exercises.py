"""Exercise extraction for the new Python stack — LLM-driven with heuristic fallback.

This module re-implements the exercise extraction that used to live in
``Woodpacker/src/lib/pipeline.ts`` (``DISCOVERY_SYSTEM`` / ``MATERIALS_SYSTEM``)
on the new architecture:

1. Page-aware chunking (``[PAGE n]`` markers preserved — never merge pages).
2. Per-chunk LLM discovery via the OpenCode endpoint (``prompt.py``), with the
   canonical prompt rules from ``Context Files/Exercise_Extraction_Skill/``.
3. Every candidate is gated by
   :func:`woodpacker_extraction.validation.validate_extracted_exercise`
   (junk rejection, answerability, MC integrity) before it is returned.
4. If the LLM is unavailable, the heuristic engine
   (``extractor.detect_exercises``) is used with the same validation gates.

Output is a list of flashcard-ready exercise dicts:
``{type, prompt, answer?, options?, page?, name?}`` plus ``source`` /
``page_number`` bookkeeping used by the relationship engine.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from .extractor import PDF_PAGE_RE, classify_exercise_type, detect_exercises
from .validation import VALID_EXERCISE_TYPES, validate_extracted_exercise

logger = logging.getLogger(__name__)

CHUNK_CHARS = 24000
MAX_EXERCISES_PER_FILE = 60

EXERCISE_TYPES_JOIN = " | ".join(VALID_EXERCISE_TYPES)

# Canonical prompt rules from prompt_rules.md. Mirrors DISCOVERY_SYSTEM in
# src/lib/pipeline.ts so the Python and TypeScript stacks stay in sync.
# Expanded to the full 6-type taxonomy required for hover-box accuracy:
# heading, text, image, audio_ref, video_ref, exercise. The layout engine
# (PyMuPDF) provides bboxes; the LLM provides semantic labels + verbatim
# text. If a page has no exercise the LLM MUST still emit its heading or a
# representative text block so the page is never reported empty.
DISCOVERY_SYSTEM = (
    "You are a course detective working with extracted text from one uploaded study file. "
    'Identify the chapter headings EXACTLY as the author wrote them, keeping their numbers '
    '(e.g. "Kapitel 3 Arbeit und Beruf", "Unit 2 — Travel"). '
    "Never invent, renumber, merge or reorder chapters. Respond ONLY with valid JSON matching: "
    '{"chapters":["string"],'
    '"headings":[{"text":"string","page":"string"}],'
    '"text_blocks":[{"text":"string","page":"string"}],'
    '"image_refs":[{"text":"string","page":"string"}],'
    '"audio_refs":[{"text":"string","page":"string"}],'
    '"video_refs":[{"text":"string","page":"string"}],'
    '"exercises":[{"type":"string","prompt":"string","page":"string","name":"string"}]}. '
    'BLOCK TAXONOMY — you MUST distinguish these six types (bboxes come from layout, you only label text): '
    'heading = chapter/lesson/section titles (Kapitel, Lektion, Unit, Lesson + number or ALL-CAPS short title); '
    'text = running paragraph/content that is NOT an exercise nor a reference; '
    'image = any mention of Bild/picture/Abbildung/Figure/Fig./Foto or caption line; '
    'audio_ref = Hör Sie Track 12, CD 1 Track 3, Spur 5, Audio, Hörtext, etc.; '
    'video_ref = Video 5, Film, Ausschnitt, ansehen; '
    'exercise = genuine learner task (imperatives like "Listen and tick", "Ergänzen Sie", "Read and answer", blanks/___ or questions). '
    'COVERAGE RULE: every [PAGE n] you receive must contribute at least one of heading/text/image even if it has zero exercises. '
    'If a page has no exercise, emit its heading (if present) or its most representative text sentence as a text_block. '
    'EXERCISE REFERENCES: every exercise must report "page" EXACTLY as "S. n" where n is the '
    "[PAGE n] marker of the page containing it. "
    '"name" is the exercise label EXACTLY as printed (e.g. "Aufgabe 5a", "Übung 3b", '
    '"Exercise 1", "1b"). Never invent page numbers or exercise names. '
    'VERBATIM TEXT: every text field (headings, text_blocks, refs, exercise prompt) must reproduce the author\'s text EXACTLY, character '
    "for character. Never paraphrase, summarize or translate it. "
    'Keep every media reference (e.g. "Hören Sie Track 12", "CD 1, Track 3", "Video 5"), every '
    'page reference (e.g. "Seite 45", "S. 45") and every solution reference (e.g. "Lösung im '
    'Lehrerhandbuch", "Siehe Lösungen") intact — they are needed to link the exercise to its '
    "audio, video, reading and solution files. "
    "EXERCISE QUALITY: Only extract genuine exercises — statements or questions that give the "
    'learner an actual task (imperatives like "Listen and tick", "Ergänzen Sie", "Read and '
    'answer", blanks, questions, roleplays). '
    'NEVER extract as exercise: audio/video CD track listings (e.g. "1.07", "CD 1, Track 3", "Spur 5"), '
    'table-of-contents entries, chapter or activity titles standing alone (e.g. "Sie oder du?"), '
    'CEFR level markers (A1, B2, C1), page references or "› 20" arrows, or index/solution-key '
    "fragments. Put those lines in their correct bucket (heading/audio_ref/video_ref/text) instead. "
    "If a line is only a title, a track number, a level or a page marker, it is NOT an exercise "
    f'— skip it as exercise. Exercise "type" must be exactly one of: {EXERCISE_TYPES_JOIN}. '
)

# Materials-style rules — appended when require_answer=True so every returned
# exercise carries an answer key (mirrors MATERIALS_SYSTEM + prompt_rules.md).
MATERIALS_ANSWER_RULES = (
    "Every exercise MUST be answerable: fill-blank, multiple-choice, translation and recall "
    'MUST carry a non-empty "answer" field. For multiple-choice provide EXACTLY 4 "options" '
    'and the "answer" MUST be one of the options verbatim (no "all of the above", no answer '
    "missing from the list, no duplicate options). "
    'Open-ended types (pattern-drill, roleplay, comprehension, assessment) do not need an '
    '"answer". If the source text does not expose the answer, do NOT fabricate one — skip that '
    "exercise. "
)

_EXTRACT_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)
_FENCE_RE = re.compile(r"```(?:json)?\s*|\s*```")


def _extract_json(raw: str) -> Optional[dict[str, Any]]:
    """Parse JSON out of an LLM response, tolerating code fences and prose."""
    if not raw:
        return None
    text = _FENCE_RE.sub("", raw.strip())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = _EXTRACT_JSON_RE.search(text)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def _response_text(content: Any) -> str:
    """Normalize LangChain message content (str or list of blocks) to str."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text" and block.get("text"):
                    parts.append(block["text"])
                elif block.get("text"):
                    parts.append(str(block["text"]))
            elif isinstance(block, str):
                parts.append(block)
        return "\n".join(parts)
    return str(content or "")


# ---------------------------------------------------------------------------
# Chunking (page-aware, mirrors src/lib/pipeline.ts splitPages/chunkPages)
# ---------------------------------------------------------------------------


def _split_pages(text: str) -> list[tuple[int, str]]:
    pages: list[tuple[int, str]] = []
    current_n = 0
    last = 0
    for m in PDF_PAGE_RE.finditer(text):
        before = text[last : m.start()]
        if current_n > 0 and before.strip():
            pages.append((current_n, before))
        current_n = int(m.group(1))
        last = m.end()
    if current_n > 0 and text[last:].strip():
        pages.append((current_n, text[last:]))
    return pages


def _chunk_pages(pages: list[tuple[int, str]]) -> list[tuple[int, str]]:
    """Group pages so every chunk contains exactly ONE page (long pages stay whole)."""
    chunks: list[tuple[int, str]] = []
    cur: list[tuple[int, str]] = []
    size = 0

    def flush() -> None:
        nonlocal cur, size
        if not cur:
            return
        n = cur[0][0]
        text = "\n\n".join(f"[PAGE {p}] {t}" for p, t in cur)
        chunks.append((n, text))
        cur = []
        size = 0

    for n, t in pages:
        if cur and n != cur[0][0]:
            flush()
        cur.append((n, t))
        size += len(t)
        if size >= CHUNK_CHARS:
            flush()
    flush()
    return chunks


def _chunk_text(text: str) -> list[str]:
    chunks: list[str] = []
    remaining = text
    while len(remaining) > CHUNK_CHARS:
        cut = remaining.rfind("\n\n", 0, CHUNK_CHARS)
        if cut < CHUNK_CHARS / 2:
            cut = remaining.rfind(". ", 0, CHUNK_CHARS)
        if cut < CHUNK_CHARS / 2:
            cut = CHUNK_CHARS
        chunks.append(remaining[:cut])
        remaining = remaining[cut:]
    if remaining.strip():
        chunks.append(remaining)
    return chunks


# ---------------------------------------------------------------------------
# LLM extraction
# ---------------------------------------------------------------------------


def _llm_available() -> bool:
    try:
        from .prompt import opencode_configured

        return opencode_configured()
    except Exception:  # noqa: BLE001
        return False


def _dedupe_exercises(
    exercises: list[dict[str, Any]], key: str = "prompt"
) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for ex in exercises:
        k = (ex.get(key) or "").strip().lower()
        if not k or k in seen:
            continue
        seen.add(k)
        out.append(ex)
    return out


def llm_extract_exercises(
    asset_name: str,
    text: str,
    *,
    require_answer: bool = False,
    max_exercises: int = MAX_EXERCISES_PER_FILE,
    pages: Optional[list[int]] = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """LLM exercise discovery over page-aware chunks with validation.

    ``pages`` restricts extraction to specific page numbers (repair passes).

    Returns ``(exercises, chapters, stats)`` where stats reports
    mode/capped/chunks so callers never have to guess whether a safety limit
    fired.
    """
    import threading
    from concurrent.futures import ThreadPoolExecutor, as_completed

    stats: dict[str, Any] = {"mode": "llm", "capped": False, "chunks": 0, "failed_chunks": 0}
    if not _llm_available():
        stats["mode"] = "unavailable"
        return [], [], stats

    from langchain_core.messages import HumanMessage, SystemMessage

    from .llm import chat_invoke
    from .prompt import get_chat_model

    system = DISCOVERY_SYSTEM
    if require_answer:
        system += MATERIALS_ANSWER_RULES

    model = get_chat_model()
    all_exercises: list[dict[str, Any]] = []
    chapters: list[str] = []
    _lock = threading.Lock()

    # Collect layout taxonomy from LLM so pages without exercises are not empty.
    headings: list[dict[str, Any]] = []
    text_blocks: list[dict[str, Any]] = []
    image_refs: list[dict[str, Any]] = []
    audio_refs: list[dict[str, Any]] = []
    video_refs: list[dict[str, Any]] = []

    def process_chunk(header: str, body: str, page_override: Optional[int]) -> None:
        with _lock:
            stats["chunks"] += 1
        try:
            resp = chat_invoke(
                model,
                [
                    SystemMessage(content=system),
                    HumanMessage(
                        content=(
                            f"{header}EXTRACTED TEXT:\n{body}\n\n"
                            "Return the extraction JSON."
                        )
                    ),
                ],
            )
        except Exception as exc:  # noqa: BLE001
            with _lock:
                stats["failed_chunks"] += 1
            logger.warning("LLM chunk failed: %s", exc)
            return
        data = _extract_json(_response_text(resp.content))
        if not data:
            return
        with _lock:
            for c in data.get("chapters") or []:
                if isinstance(c, str):
                    chapters.append(c)
            # New taxonomy buckets — always page-tagged to the current chunk.
            for bucket, store in (
                ("headings", headings),
                ("text_blocks", text_blocks),
                ("image_refs", image_refs),
                ("audio_refs", audio_refs),
                ("video_refs", video_refs),
            ):
                for raw in data.get(bucket) or []:
                    if not isinstance(raw, dict):
                        continue
                    txt = (raw.get("text") or "").strip()
                    if not txt or len(txt) < 2:
                        continue
                    # Keep verbatim but capped; page forced to the chunk's page.
                    entry: dict[str, Any] = {"text": txt[:400]}
                    entry["page"] = f"S. {page_override}" if page_override is not None else (raw.get("page") or "")
                    store.append(entry)
            for raw in data.get("exercises") or []:
                if not isinstance(raw, dict):
                    continue
                if page_override is not None:
                    raw.setdefault("page", f"S. {page_override}")
                result = validate_extracted_exercise(raw, require_answer=require_answer)
                if result.valid and result.exercise:
                    all_exercises.append(result.exercise)

    pages_split = _split_pages(text)
    if pages:
        wanted = set(pages)
        pages_split = [(n, body) for n, body in pages_split if n in wanted]
    chunk_tasks: list[tuple[str, str, Optional[int]]] = []
    if pages_split:
        for n, body in _chunk_pages(pages_split):
            header = (
                f"FILE: {asset_name}\n"
                f"You are analyzing ONLY the text of PDF page [PAGE {n}]. "
                f"Every exercise found in this text belongs to that page. "
                f'Set each exercise\'s "page" field to EXACTLY "S. {n}". '
                "Do not report any other page number.\n\n"
            )
            chunk_tasks.append((header, body, n))
    else:
        chunks = _chunk_text(text)
        for index, body in enumerate(chunks):
            header = (
                f"FILE: {asset_name}\n"
                + (
                    f"This is chunk {index + 1} of {len(chunks)} of the extracted text. "
                    "Analyze this portion.\n\n"
                    if len(chunks) > 1
                    else "Analyze this portion.\n\n"
                )
            )
            chunk_tasks.append((header, body, None))

    # Bounded concurrency — 4 workers matches LLM_CONCURRENCY and keeps
    # 274-page books from taking 20 min serially (now ~6 min / 4 ≈ 1.5 min)
    if len(chunk_tasks) > 1:
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = [executor.submit(process_chunk, h, b, p) for h, b, p in chunk_tasks]
            for f in as_completed(futures):
                f.result()
    else:
        for h, b, p in chunk_tasks:
            process_chunk(h, b, p)

    exercises = _dedupe_exercises(all_exercises)
    # De-dupe layout buckets as well (by normalized text) so heading/text coverage isn't inflated.
    def _dedupe_layout(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seen: set[str] = set()
        out: list[dict[str, Any]] = []
        for it in items:
            k = it.get("text","").strip().lower()
            if not k or k in seen:
                continue
            seen.add(k)
            out.append(it)
        return out
    deduped_headings = _dedupe_layout(headings)
    deduped_text = _dedupe_layout(text_blocks)
    deduped_image = _dedupe_layout(image_refs)
    deduped_audio = _dedupe_layout(audio_refs)
    deduped_video = _dedupe_layout(video_refs)

    stats["capped"] = len(exercises) > max_exercises
    stats["headings"] = len(deduped_headings)
    stats["text_blocks"] = len(deduped_text)
    stats["image_refs"] = len(deduped_image)
    stats["audio_refs"] = len(deduped_audio)
    stats["video_refs"] = len(deduped_video)
    # Coverage helper for callers that only look at stats: if a page would otherwise be empty, the LLM now guarantees at least heading/text.
    stats["layout_blocks"] = len(deduped_headings) + len(deduped_text) + len(deduped_image) + len(deduped_audio) + len(deduped_video)
    if stats["capped"]:
        logger.warning(
            "Exercise cap reached for %s (%d > %d) — flagged, NOT silently truncated",
            asset_name, len(exercises), max_exercises,
        )
    exercises = exercises[:max_exercises]
    logger.info(
        "LLM extraction: %d valid exercises for %s — layout h:%d t:%d img:%d a:%d v:%d",
        len(exercises), asset_name, len(deduped_headings), len(deduped_text), len(deduped_image), len(deduped_audio), len(deduped_video),
    )
    # Stash deduped layout for the graph layer to merge into asset when PyMuPDF dict is sparse (scanned).
    stats["_headings"] = deduped_headings
    stats["_text_blocks"] = deduped_text
    stats["_image_refs"] = deduped_image
    stats["_audio_refs"] = deduped_audio
    stats["_video_refs"] = deduped_video
    return exercises, chapters, stats


# ---------------------------------------------------------------------------
# Heuristic extraction (fallback, same validation gates)
# ---------------------------------------------------------------------------

# Maps the coarse extractor types (extractor.EXERCISE_TYPE_KEYWORDS) onto the
# 8 flashcard types — mirrors heuristics.ts classifyExercise.
_TYPE_MAP = {
    "multiple_choice": "multiple-choice",
    "translation": "translation",
    "listening": "comprehension",
    "video_comprehension": "comprehension",
    "reading_comprehension": "comprehension",
    "speaking": "roleplay",
    "pronunciation": "pattern-drill",
    "dialogue_completion": "roleplay",
    "sentence_building": "recall",
    "vocabulary": "recall",
    "grammar": "fill-blank",
    "matching": "recall",
    "writing": "assessment",
    "fill_blank": "fill-blank",
    "open_ended": "assessment",
}


def map_flashcard_type(coarse: str) -> str:
    """Map an extractor exercise type onto a flashcard VALID_EXERCISE_TYPES value."""
    return _TYPE_MAP.get(coarse, "assessment")


_STRIP_JUNK_LINE_RE = [
    re.compile(r"^\d+(\.\d+)?$"),  # track numbers: "1.07"
    re.compile(r"^cd\b.*$", re.IGNORECASE),  # "CD 1, Track 3"
    re.compile(r"^(track|spur)\b.*$", re.IGNORECASE),  # "Spur 5"
    re.compile(r"^›.*$"),  # page arrows: "› 20"
    re.compile(r"^[a-cA-C][12]$"),  # CEFR markers: A1..C2
    re.compile(r"^LERNWORTSCHATZ$", re.IGNORECASE),  # standalone level labels
    re.compile(r"^(cd|track|spur|dvd)\s*[\d.,:\s-]+$", re.IGNORECASE),
]

_CEFR_RE = re.compile(r"^[a-cA-C][12]$")


def _strip_junk_lines(text: str) -> str:
    """Remove track-listing / marker lines before heuristic detection.

    Mirrors the junk rules in prompt_rules.md that the LLM path follows
    natively; the heuristic path applies them line-wise so track listings and
    markers never glue themselves onto the start of a real exercise.
    """
    kept: list[str] = []
    for line in (text or "").splitlines():
        trimmed = line.strip()
        if not trimmed:
            kept.append(line)
            continue
        if any(regex.match(trimmed) for regex in _STRIP_JUNK_LINE_RE):
            continue
        kept.append(line)
    return "\n".join(kept)


_OPTION_LINE_RE = re.compile(r"^([a-f])\s*[).]\s*(.+)$", re.IGNORECASE)


def _extract_inline_options(prompt: str) -> tuple[str, list[str]]:
    """Parse trailing letter-prefixed lines (a) … b) …) into MC options.

    Heuristic detection classifies many prompts as multiple-choice from
    verbs like "Kreuzen Sie an" without carrying an options array; the MC
    validation gate would then reject valid exercises. Options stay IN the
    prompt text (verbatim rule) and are additionally attached structured.
    """
    lines = prompt.splitlines()
    options: list[str] = []
    idx = len(lines)
    for i in range(len(lines) - 1, -1, -1):
        m = _OPTION_LINE_RE.match(lines[i].strip())
        if not m:
            break
        options.insert(0, m.group(2).strip())
        idx = i
    return prompt, options


def heuristic_extract_exercises(
    text: str,
    *,
    require_answer: bool = False,
    max_exercises: int = MAX_EXERCISES_PER_FILE,
    pages: Optional[list[int]] = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Heuristic extraction with the same validation gates.

    Uses ``extractor.detect_exercises`` (Stage 5 line-based detection) and
    ``classify_exercise_type`` for the type. Junk and answerability rules are
    enforced identically to the LLM path. Returns ``(exercises, stats)``.
    """
    stats: dict[str, Any] = {"mode": "heuristic", "capped": False, "chunks": 0, "failed_chunks": 0}
    candidates = detect_exercises(_strip_junk_lines(text))
    if pages:
        wanted = set(pages)
        candidates = [c for c in candidates if _candidate_page(c) in wanted]
    exercises: list[dict[str, Any]] = []
    for ex in candidates:
        _prompt, options = _extract_inline_options(ex.get("prompt", ""))
        raw = {
            "type": map_flashcard_type(classify_exercise_type(ex.get("prompt", ""))),
            "prompt": ex.get("prompt", ""),
            "page": ex.get("page"),
            "name": ex.get("name"),
        }
        if options:
            raw["options"] = options
        result = validate_extracted_exercise(raw, require_answer=require_answer)
        if result.valid and result.exercise:
            exercises.append(result.exercise)
    exercises = _dedupe_exercises(exercises)
    stats["capped"] = len(exercises) > max_exercises
    return exercises[:max_exercises], stats


def _candidate_page(candidate: dict[str, Any]) -> int | None:
    page = candidate.get("page")
    if not page:
        return None
    import re as _re

    m = _re.search(r"(\d+)", str(page))
    return int(m.group(1)) if m else None


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def extract_exercises(
    asset_name: str,
    text: str,
    *,
    require_answer: bool = False,
    prefer_llm: bool = True,
    max_exercises: int = MAX_EXERCISES_PER_FILE,
    pages: Optional[list[int]] = None,
) -> dict[str, Any]:
    """Extract validated exercises from a file's extracted text.

    Strategy (mirrors the old pipeline's two extraction sites):
    - ``require_answer=False``: discovery-style extraction — the source may not
      expose answers; junk/track/level/marker lines are always rejected.
    - ``require_answer=True``: materials-style extraction — every returned
      exercise of an answer-requiring type carries an answer key; candidates
      that cannot be answered are skipped, never fabricated.

    Returns ``{"mode": "llm"|"heuristic", "exercises": [...], "stats": {...}}``
    where ``stats.capped`` reports a hit safety cap (never silent truncation).
    """
    stats: dict[str, Any] = {"mode": "heuristic", "capped": False, "chunks": 0, "failed_chunks": 0}
    llm_exercises: list[dict[str, Any]] = []
    if prefer_llm:
        llm_exercises, _chapters, llm_stats = llm_extract_exercises(
            asset_name, text, require_answer=require_answer, max_exercises=max_exercises, pages=pages
        )
        if llm_stats.get("mode") != "unavailable":
            stats = llm_stats
    if llm_exercises:
        return {"mode": "llm", "exercises": llm_exercises, "stats": stats}
    heuristic, heuristic_stats = heuristic_extract_exercises(
        text, require_answer=require_answer, max_exercises=max_exercises, pages=pages
    )
    return {"mode": "heuristic", "exercises": heuristic, "stats": heuristic_stats}