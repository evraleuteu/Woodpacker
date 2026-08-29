"""Stage 9 support: media-ref extraction, exercise segmentation and typing.

Split into two independently testable halves:

* :func:`segment_exercises`  - pure geometry/reading-order grouping; produces
  Exercise SHELLS with stable ids and member block lists (placeholder type).
* :func:`finalize_exercises` - mutates shells in place: deterministic type
  scoring (:func:`classify_exercise_type`), bounded LLM refinement, prompt /
  name extraction, solution-reference detection.

Stable ids make segmentation order-insensitive for downstream consumers:
``{file_id}_{book_code}_{page}_{seq}``.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

from .types import AudioReference, Exercise, LayoutBlock

logger = logging.getLogger(__name__)

EXERCISE_HEAD_RE = re.compile(
    r"^\s*(aufgabe|übung|ubung|exercise|task|activity|arbeit(?:s)?blatt)\s*[-–.]?\s*\d+", re.IGNORECASE
)
NUMBER_PREFIX_RE = re.compile(r"^\s*(\d{1,3})\s*[.)]")
SOLUTION_REF_RE = re.compile(r"\b(lösung(?:en)?|loesung(?:en)?|solutions?)\b", re.IGNORECASE)

AUDIO_TRACK_RE = re.compile(
    r"\bcd\s*(\d+)?[,\s]*(?:track|spur|hörtext|hoertext|teil)?\s*[\d.\-]*?(\d{1,3})?",
    re.IGNORECASE,
)
TRACK_STRICT_RE = re.compile(
    r"(?:cd\s*(\d+)\s*[,.]?\s*)?(?:track|spur|hörtext|hoertext)\s*:?\s*(\d{1,3})",
    re.IGNORECASE,
)
VIDEO_REF_RE = re.compile(r"(?:video|film)\s*:?\s*(\d{1,3})", re.IGNORECASE)

# ---------------------------------------------------------------------------
# Type cue table: (exercise_type, regex, weight)
# ---------------------------------------------------------------------------

_CUES: tuple[tuple[str, str, float], ...] = (
    ("listening", r"hören sie|hoeren sie|hörtext|hoertext|\btrack\b|\bcd\s*\d|\baudio\b", 3.0),
    ("listening", r"\bhören\b|\bzu hören\b", 0.8),
    ("true_false", r"richtig oder falsch|richtig/falsch|\br/f\b|wahr oder falsch", 3.2),
    ("multiple_choice", r"wählen sie|kreuzen sie (?:die |das |an)|welche antwort|ankreuzen", 2.6),
    ("matching", r"ordnen sie|verbinden sie|zuordnen|zuordnung|paare\b|match\b", 2.8),
    ("ordering", r"reihenfolge|nummerieren sie|durchnummerieren|bringen sie die", 2.8),
    ("fill_blank", r"ergänzen sie|setzen sie ein|füllen sie|lücken|complete|fill in", 2.4),
    ("image_description", r"beschreiben sie (?:das )?(?:bild|foto)|was sehen sie auf", 3.0),
    ("dialogue", r"\bdialog\b|rollenspiel|gespräch|gespraech|spielen sie (?:den |ein )?dialog", 2.6),
    ("speaking", r"sprechen sie|erzählen sie|erzaehlen sie|interviewen sie|stellen sie fragen|berichten sie", 2.0),
    ("reading", r"lesen sie|leseverstehen", 2.0),
    ("writing", r"schreiben sie|verfassen sie|aufsatz|e-mail|email|\bbrief\b", 2.0),
    ("grammar", r"grammatik|konjugation|präsens|praesens|präteritum|praeteritum|perfekt|adjektiv|artikel", 1.5),
    ("vocabulary", r"wortschatz|vokabeln|wörter|woerter|begriffe", 1.4),
    ("drag_drop", r"ziehen sie|ziehe die|drag.?drop", 2.5),
)

_OPTION_LETTERS_RE = re.compile(r"(?:^|\n)\s*[a-d]\s*[.)]\s+\S", re.IGNORECASE | re.MULTILINE)
_GAP_RE = re.compile(r"_{3,}|\.{6,}|\(\s*[a-zäöüß-]{2,25}\s*\)")
_QUESTION_MARK_RE = re.compile(r"\?")

_LLM_CALLS = {"count": 0}


def last_llm_call_count() -> int:
    return _LLM_CALLS["count"]


def reset_llm_budget() -> None:
    _LLM_CALLS["count"] = 0


def llm_min_confidence() -> float:
    return float(os.environ.get("EXERCISE_LLM_MIN_CONFIDENCE", "0.55"))


def llm_max_calls() -> int:
    return int(os.environ.get("EXERCISE_LLM_MAX_CALLS", "16"))


# ---------------------------------------------------------------------------
# Media reference extraction (Stage 7 input)
# ---------------------------------------------------------------------------


def extract_media_refs(blocks: list[LayoutBlock]) -> list[AudioReference]:
    """Extract CD/Track/audio/video references from reference-typed blocks."""
    refs: dict[str, AudioReference] = []
    for block in blocks:
        if block.type not in ("audio_reference", "video_reference") or not block.text.strip():
            continue
        text = block.text.strip()
        if block.type == "video_reference" or VIDEO_REF_RE.search(text):
            m = VIDEO_REF_RE.search(text)
            track = int(m.group(1)) if m else None
            ref_id = f"video_{track}" if track is not None else f"ref_{block.block_id}"
        else:
            m = TRACK_STRICT_RE.search(text)
            cd_no = int(m.group(1)) if m and m.group(1) else None
            track = int(m.group(2)) if m and m.group(2) else None
            ref_id = f"track_{track}" if track is not None else f"ref_{block.block_id}"
        existing = next((r for r in refs if r.ref_id == ref_id), None)
        if existing is None:
            existing = AudioReference(
                ref_id=ref_id,
                track=track,
                cd=cd_no if block.type != "video_reference" else None,
                kind="video" if block.type == "video_reference" or VIDEO_REF_RE.search(text) else "audio",
                raw_text=text[:120],
            )
            refs.append(existing)
        if block.block_id not in existing.block_ids:
            existing.block_ids.append(block.block_id)
    return refs


# ---------------------------------------------------------------------------
# Type classification (deterministic + bounded LLM refinement)
# ---------------------------------------------------------------------------


def classify_exercise_type(
    text: str,
    *,
    has_options: bool = False,
    has_gaps: bool = False,
    has_audio: bool = False,
    has_image: bool = False,
) -> tuple[str, float]:
    """Deterministic scoring over the 15-type taxonomy."""
    lower = (text or "").lower()
    scores: dict[str, float] = {}

    for ex_type, pattern, weight in _CUES:
        if re.search(pattern, lower):
            scores[ex_type] = scores.get(ex_type, 0.0) + weight

    if has_options or _OPTION_LETTERS_RE.search(text):
        scores["multiple_choice"] = scores.get("multiple_choice", 0.0) + 2.2
    if has_gaps or _GAP_RE.search(text):
        scores["fill_blank"] = scores.get("fill_blank", 0.0) + 1.6
    if has_audio:
        scores["listening"] = scores.get("listening", 0.0) + 2.4
    if has_image:
        scores["image_description"] = scores.get("image_description", 0.0) + 1.2

    if not scores:
        if _QUESTION_MARK_RE.search(text) and len(text) < 400:
            return "open_question", 0.45
        return "open_question", 0.35

    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    best_type, best_score = ranked[0]
    second_score = ranked[1][1] if len(ranked) > 1 else 0.0
    total = sum(scores.values()) or 1.0
    share = best_score / total
    margin = (best_score - second_score) / max(best_score, 1.0)
    confidence = min(0.98, 0.45 + 0.4 * share + 0.25 * margin)
    if best_score < 1.2:
        confidence = min(confidence, 0.6)
    return best_type, round(confidence, 3)


_LLM_TYPE_ALIAS = {
    "video_comprehension": "reading",
    "reading_comprehension": "reading",
    "sentence_building": "ordering",
    "dialogue_completion": "dialogue",
    "pronunciation": "speaking",
    "translation": "writing",
    "open_ended": "open_question",
}


def classify_with_llm_refinement(text: str, heuristic: tuple[str, float]) -> tuple[str, float]:
    """Refine below-threshold classifications via the LLM (bounded)."""
    ex_type, conf = heuristic
    if conf >= llm_min_confidence() or not os.environ.get("OPENCODE_API_KEY"):
        return ex_type, conf
    if _LLM_CALLS["count"] >= llm_max_calls():
        return ex_type, conf
    try:
        from ..vision import classify_exercise_type as _llm

        result = _llm(text[:800])
        if not result:
            return ex_type, conf
        _LLM_CALLS["count"] += 1
        mapped = _LLM_TYPE_ALIAS.get(str(result.get("exercise_type") or ""), str(result.get("exercise_type") or ""))
        from .types import VALID_EXERCISE_TYPES

        if mapped not in VALID_EXERCISE_TYPES:
            return ex_type, conf
        llm_conf = max(0.0, min(1.0, float(result.get("confidence", 0.5))))
        blended = max(conf, min(0.97, llm_conf * 0.9))
        return mapped, round(blended, 3)
    except Exception as exc:  # noqa: BLE001
        logger.debug("LLM exercise typing failed: %s", exc)
        return ex_type, conf


# ---------------------------------------------------------------------------
# Segmentation (geometry only)
# ---------------------------------------------------------------------------


def book_code(filename: str, sha256: str) -> str:
    m = re.match(r"^.*?([A-Z]\d)[^a-zA-Z\d]", os.path.basename(filename) + "_")
    if m:
        return m.group(1).upper()
    return sha256[:4].upper() if sha256 else "DOC"


def segment_exercises(
    ordered_ids: list[str],
    blocks_by_id: dict[str, LayoutBlock],
    *,
    file_id: str,
    filename: str,
    sha256: str,
    audio_refs: list[AudioReference],
) -> list[Exercise]:
    """Group reading-ordered blocks into exercise shells (no typing yet)."""
    code = book_code(filename, sha256)
    ref_ids = {r.ref_id for r in audio_refs}

    exercises: list[Exercise] = []
    current: dict[str, Any] | None = None
    seq_on_page: dict[int, int] = {}
    trailing_noise = 0

    def close_current() -> None:
        nonlocal current
        if current is None:
            return
        cur = current
        bbox = _union_bbox([cur["head_bbox"]] + cur["member_bboxes"])
        page_start = cur["page"]
        n = seq_on_page.get(page_start, 0) + 1
        seq_on_page[page_start] = n
        head = cur["head_text"]
        name = ""
        m = re.search(r"(?:aufgabe|übung|ubung|exercise|task)\s*[-–.]?\s*\d+[a-z]?", head, re.IGNORECASE)
        if m:
            name = m.group(0).strip()
        elif cur["question_texts"]:
            qm = NUMBER_PREFIX_RE.match(cur["question_texts"][0])
            if qm:
                name = f"Aufgabe {qm.group(1)}"
        exercises.append(
            Exercise(
                exercise_id=f"{file_id}_{code}_{page_start}_{n}",
                page_start=page_start,
                page_end=max(cur["last_page"], page_start),
                bbox=bbox,
                instruction_block=cur["instruction_block"],
                question_blocks=list(dict.fromkeys(cur["question_blocks"])),
                image_blocks=list(dict.fromkeys(cur["images"])),
                audio_references=[r for r in dict.fromkeys(cur["audio"]) if r in ref_ids],
                solution_blocks=[],
                answer_area_blocks=list(dict.fromkeys(cur["answer_blocks"])),
                exercise_type="open_question",
                type_confidence=0.3,
                name=name,
                prompt=head,
                confidence=round(min(0.95, 0.55 + 0.08 * len(cur["question_blocks"]) + (0.15 if head else 0.0)), 3),
                signals=["segmented"],
            )
        )
        current = None

    for bid in ordered_ids:
        block = blocks_by_id.get(bid)
        if block is None:
            continue
        btype = block.type
        text = block.text.strip()

        if btype == "instruction" or btype == "exercise" or (
            btype == "title" and EXERCISE_HEAD_RE.match(text)
        ):
            close_current()
            current = _new_shell(block)
            trailing_noise = 0
            continue

        if current is None:
            if btype == "question":
                current = _new_shell(block)
                current["head_text"] = ""
                current["instruction_block"] = None
            else:
                continue

        if btype == "question":
            current["question_blocks"].append(bid)
            current["question_texts"].append(text)
            current["member_bboxes"].append(block.bbox)
            current["last_page"] = block.page
            trailing_noise = 0
        elif btype == "answer_area":
            current["answer_blocks"].append(bid)
            current["member_bboxes"].append(block.bbox)
            current["last_page"] = block.page
            trailing_noise = 0
        elif btype == "image":
            current["images"].append(bid)
            current["member_bboxes"].append(block.bbox)
            current["last_page"] = block.page
        elif btype in ("audio_reference", "video_reference"):
            ref = next((r for r in audio_refs for bl in r.block_ids if bl == bid), None)
            if ref is not None:
                current["audio"].append(ref.ref_id)
            current["member_bboxes"].append(block.bbox)
            current["last_page"] = block.page
        else:
            trailing_noise += 1
            if trailing_noise >= 4:
                close_current()

    close_current()
    return exercises


def _new_shell(block: LayoutBlock) -> dict[str, Any]:
    return {
        "page": block.page,
        "last_page": block.page,
        "head_text": block.text.strip()[:300],
        "head_bbox": block.bbox,
        "instruction_block": block.block_id,
        "question_blocks": [],
        "question_texts": [],
        "images": [],
        "audio": [],
        "answer_blocks": [],
        "member_bboxes": [],
    }


# ---------------------------------------------------------------------------
# Finalization (typing + prompts + solutions)
# ---------------------------------------------------------------------------


def finalize_exercises(
    exercises: list[Exercise],
    *,
    blocks_by_id: dict[str, LayoutBlock],
    ocr_by_block: dict[str, str],
    llm_budget_reset: bool = True,
) -> None:
    """Mutate each shell into a fully typed exercise record."""
    if llm_budget_reset:
        reset_llm_budget()
    for ex in exercises:
        texts: list[str] = []
        if ex.instruction_block:
            blk = blocks_by_id.get(ex.instruction_block)
            if blk:
                texts.append(ocr_by_block.get(blk.block_id) or blk.text)
        for qid in ex.question_blocks:
            blk = blocks_by_id.get(qid)
            if blk:
                texts.append(ocr_by_block.get(qid) or blk.text)
        body = "\n".join(t for t in texts if t).strip()

        etype, econf = classify_exercise_type(
            body,
            has_gaps=bool(ex.answer_area_blocks),
            has_audio=bool(ex.audio_references),
            has_image=bool(ex.image_blocks),
        )
        etype, econf = classify_with_llm_refinement(body, (etype, econf))
        ex.exercise_type = etype
        ex.type_confidence = econf
        ex.signals = [f"type:{etype}", *(["with_audio"] if ex.audio_references else []),
                      *(["with_image"] if ex.image_blocks else [])]

        # Solution references inside instruction/question text.
        if body and SOLUTION_REF_RE.search(body):
            ex.solution_blocks.append("solution_ref")
        ex.prompt = body[:500]


def _union_bbox(boxes: list[Any]) -> tuple[float, float, float, float]:
    valid = [b for b in boxes if b]
    if not valid:
        return (0.0, 0.0, 0.0, 0.0)
    x0 = min(b[0] for b in valid)
    y0 = min(b[1] for b in valid)
    x1 = max(b[2] for b in valid)
    y1 = max(b[3] for b in valid)
    return (x0, y0, x1, y1)
