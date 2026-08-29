"""Stage 5: Block classification — RULES FIRST, LLM only for low confidence.

Deterministic signals (in priority order):

* geometry      header/footer bands, page numbers
* typography    title/subtitle font ratios come from the layout provider
* numbering     ``1.`` ``2.`` ``3.`` / ``a)`` ``b)`` ``c)`` item starts -> question
* imperatives   German exercise instructions ("Hören Sie", "Ordnen Sie zu",
                "Kreuzen Sie an", ...) -> instruction
* media cues    CD/Track/Audio -> audio reference, Video/Film -> video reference
* gap markers   ``___``, ``(arbeiten)`` -> answer_area / fill-blank question

Only when the combined rule confidence lands below
``CLASSIFY_LLM_MIN_CONFIDENCE`` (default 0.55) and an LLM key is configured,
a bounded number of blocks per document (``CLASSIFY_LLM_MAX_CALLS``) are
re-classified by the LLM (``method="llm"``).
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

from .types import VALID_BLOCK_TYPES, BBox, Classification, LayoutBlock

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Deterministic patterns
# ---------------------------------------------------------------------------

NUMBERED_ITEM_RE = re.compile(r"^\s*(\d{1,3}\s*[.)]|[a-h]\s*[.)])\s+\S", re.IGNORECASE)
MULTI_NUMBERING_RE = re.compile(r"(?:^|\n)\s*\d{1,3}\s*[.)]", re.MULTILINE)
ALPHA_NUMBERING_RE = re.compile(r"(?:^|\n)\s*[a-h]\s*[.)]", re.MULTILINE)

IMPERATIVE_RE = re.compile(
    r"(?:^\s*\d{0,3}\s*[.:)]?\s*)("
    r"kreuzen sie|ergänzen sie|erganzen sie|ordnen sie|verbinden sie|zuordnen|"
    r"schreiben sie|lesen sie|hören sie|hoeren sie|hören sie zu|sehen sie|"
    r"markieren sie|unterstreichen sie|setzen sie|bilden sie|antworten sie|"
    r"wählen sie|waehlen sie|beschreiben sie|erzählen sie|erzaehlen sie|"
    r"diskutieren sie|präsentieren sie|praesentieren sie|übersetzen sie|"
    r"uebersetzen sie|berichten sie|nennen sie|kombinieren sie|spielen sie|"
    r"stellen sie|sprechen sie|suchen sie|finden sie|kreise ein|underline|circle|"
    r"match|complete|fill in|choose|listen|read|write|describe|put the|sort the"
    r")\b",
    re.IGNORECASE,
)

MATCHING_CUES_RE = re.compile(r"ordnen sie zu|ordnen sie die|verbinden sie|zuordnen|zuordnung|match\b", re.IGNORECASE)

AUDIO_REF_RE = re.compile(r"\b(cd|hörtext|hoertext|track|spur|audio)\s*[\d.]|\baudio\b", re.IGNORECASE)
VIDEO_REF_RE = re.compile(r"\b(video|film)\s*[\d.]|\bvideo\b|\bfilm\b", re.IGNORECASE)

GAP_MARKERS_RE = re.compile(r"_{3,}|\.{6,}|\(\s*[a-zäöüß-]{2,25}\s*\)|\[\s*\]|\(\s*\)", re.IGNORECASE)
TRUE_FALSE_RE = re.compile(r"richtig|falsch|r/f|true|false", re.IGNORECASE)

QUESTION_WORD_RE = re.compile(
    r"\b(wer|was|wann|wo|wie|warum|welche|welcher|welches|wieso|womit|an wen|von wem|who|what|where|when|why|how)\b",
    re.IGNORECASE,
)

PAGE_NUMBER_RE = re.compile(r"^[-–—\s]*(\d{1,3})[-–—\s]*$")

# Category mapping: extended taxonomy -> spec categories.
# Supports full hierarchical taxonomy required by the spec (background,
# design_element, level_badge, etc.) while keeping rules deterministic.
_TYPE_TO_CATEGORY = {
    "title": "header",
    "subtitle": "header",
    "paragraph": "paragraph",
    "exercise": "exercise",
    "instruction": "instruction",
    "question": "question",
    "answer_area": "answer_area",
    "image": "image",
    "table": "table",
    "header": "header",
    "footer": "footer",
    "audio_reference": "reference",
    "video_reference": "reference",
    "page_number": "footer",
    "caption": "caption",
    "unknown": "unknown",
    # extended atomic/visual types
    "text": "paragraph",
    "label": "paragraph",
    "list": "paragraph",
    "list_item": "question",
    "answer": "answer_area",
    "table_cell": "paragraph",
    "illustration": "image",
    "photo": "image",
    "diagram": "image",
    "qr_code": "image",
    "barcode": "image",
    "audio_marker": "reference",
    "video_marker": "reference",
    "icon": "image",
    "logo": "image",
    "design_element": "image",
    "level_badge": "image",
    "section_marker": "image",
    "decorative_shape": "image",
    "background": "unknown",
    "page_decoration": "unknown",
    "media_marker": "reference",
}

# Extended taxonomy: maps every valid block type to a coarse exercise-relevant category.
# This ensures atomic line types like 'heading' map meaningfully after decomposition.
_HEADING_TITLE_RE = re.compile(r"^\s*kontext\s*$", re.IGNORECASE)
_LEVEL_BADGE_RE = re.compile(r"^\s*[A-C][12]\s*$", re.IGNORECASE)

_LLM_BUDGET = {"used": 0}


def reset_llm_budget() -> None:
    _LLM_BUDGET["used"] = 0


def llm_min_confidence() -> float:
    return float(os.environ.get("CLASSIFY_LLM_MIN_CONFIDENCE", "0.55"))


def llm_max_calls() -> int:
    return int(os.environ.get("CLASSIFY_LLM_MAX_CALLS", "24"))


# ---------------------------------------------------------------------------
# Core entry point
# ---------------------------------------------------------------------------


def classify_blocks(
    pages: list[Any],
    ocr_by_block: dict[str, str],
    *,
    page_heights: dict[int, float] | None = None,
) -> tuple[list[Classification], int]:
    """Classify every block of every page.

    Returns (classifications, llm_calls_used). Mutates ``block.type`` in place
    when a rule confidently refines the layout hint (downstream stages read
    block.type).
    """
    page_heights = page_heights or {}
    out: list[Classification] = []
    llm_calls = 0

    for page in pages:
        height = float(page_heights.get(page.page, 1000.0))
        for block in sorted(page.blocks, key=lambda b: b.block_id):
            cls = _classify_one(block, height, ocr_by_block.get(block.block_id, ""))
            out.append(cls)

            # Confident rule refinements overwrite weak layout hints.
            if cls.method in ("rules", "geometry") and cls.confidence >= 0.7 and cls.category in VALID_BLOCK_TYPES:
                block.type = cls.category if cls.category != "reference" else block.type

            if (
                cls.confidence < llm_min_confidence()
                and len(ocr_by_block.get(block.block_id, "")) >= 25
                and _LLM_BUDGET["used"] < llm_max_calls()
            ):
                llm_cls = _llm_classify_block(ocr_by_block.get(block.block_id, ""))
                if llm_cls is not None:
                    llm_calls += 1
                    _LLM_BUDGET["used"] += 1
                    out[-1] = llm_cls
                    if llm_cls.confidence >= llm_min_confidence():
                        mapped = _category_to_type(llm_cls.category)
                        if mapped and mapped in VALID_BLOCK_TYPES:
                            block.type = mapped
    return out, llm_calls


def _classify_one(block: LayoutBlock, page_height: float, ocr_text: str) -> Classification:
    text = (ocr_text or block.text or "").strip()
    signals: list[str] = []
    # Background/design are visually determined — not reclassified as text.
    if block.type in ("background", "design_element", "level_badge"):
        return Classification(block.block_id, "image" if block.type != "background" else "unknown", round(block.confidence, 3), "geometry", [f"visual:{block.type}"])
    best_category = _TYPE_TO_CATEGORY.get(block.type, "unknown")
    best_conf = min(max(block.confidence, 0.3), 0.99) * 0.6
    method = "layout"

    # If subtype is explicit from atomic stage (level_badge etc.), respect it.
    subtype = (block.subtype or block.meta.get("subtype") or "").lower() if isinstance(block.meta, dict) else ""
    if subtype == "level_badge" and _LEVEL_BADGE_RE.match(text):
        return Classification(block.block_id, "image", 0.92, "rules", ["rule:level_badge"])
    if subtype == "background":
        return Classification(block.block_id, "unknown", 0.9, "geometry", ["rule:background"])

    bbox: BBox = block.bbox
    rel_top = bbox[1] / max(page_height, 1.0)
    rel_bottom = bbox[3] / max(page_height, 1.0)

    def consider(category: str, conf: float, signal: str) -> None:
        nonlocal best_category, best_conf, method
        if conf > best_conf:
            best_category = category
            best_conf = conf
            method = "rules" if not signal.startswith("geo:") else "geometry"
        if signal not in signals:
            signals.append(signal)

    # --- Heading / title discrimination via atomic text cues (cover example) ---
    # The atomic stage already classified Kontext -> title, but rules confirm.
    low = text.lower()
    if _HEADING_TITLE_RE.match(text) and len(text) <= 20:
        consider("header", 0.88, "rule:cover_title_kontext")
        # Keep subtype for debug; do not override block.type here if already design-aware
        if block.subtype is None:
            block.subtype = "title"
    if text.strip().lower() == "deutsch als fremdsprache" and len(text) < 40:
        consider("header", 0.86, "rule:cover_subtitle")
        if block.subtype is None:
            block.subtype = "subtitle"
    if "kursbuch mit audios" in low and len(text) < 80:
        consider("paragraph", 0.85, "rule:cover_description")

    # --- Geometry rules (weak but deterministic). ---
    short_text = len(text) <= 120
    if rel_top <= 0.07 and short_text:
        consider("header", 0.72, "geo:top_band")
    elif rel_bottom >= 0.93 and short_text:
        if PAGE_NUMBER_RE.match(text):
            consider("footer", 0.92, "rule:page_number")
        else:
            consider("footer", 0.72, "geo:bottom_band")

    if not text:
        # Non-textual block: trust the layout provider.
        # Icons/backgrounds already handled above.
        return Classification(block.block_id, best_category, round(best_conf, 3), "layout", ["no_text"])

    # --- Media reference rules (very strong). ---
    is_shortish = len(text) < 140 and text.count("\n") <= 2
    if is_shortish and VIDEO_REF_RE.search(text):
        consider("reference", 0.93, "rule:video_ref")
    elif is_shortish and AUDIO_REF_RE.search(text):
        consider("reference", 0.93, "rule:audio_ref")

    # --- Numbered / lettered items -> question. ---
    if NUMBERED_ITEM_RE.match(text):
        consider("question", 0.86, "rule:numbered_item")
    if MULTI_NUMBERING_RE.search(text) and len(text) < 600:
        consider("exercise", 0.78, "rule:multiple_numbered_items")
    if ALPHA_NUMBERING_RE.search(text) and len(text) < 400 and IMPERATIVE_RE.search(text):
        consider("exercise", 0.82, "rule:alpha_items_with_imperative")

    # --- Imperative instructions. ---
    m = IMPERATIVE_RE.search(text[:200])
    if m:
        verb = (m.group(1) or "").lower()
        # Instruction vs exercise: standalone imperative line(s) => instruction;
        # imperative + items/gaps in one block => exercise.
        has_items = bool(NUMBERED_ITEM_RE.match(text)) or bool(GAP_MARKERS_RE.search(text))
        if has_items:
            consider("exercise", 0.84, f"rule:imperative_with_content:{verb}")
        elif len(text) < 220:
            consider("instruction", 0.83, f"rule:imperative:{verb}")

    # --- Matching cues (spec example). ---
    if MATCHING_CUES_RE.search(text):
        consider("exercise", 0.88, "rule:matching_cue")

    # --- True/false cue. ---
    if TRUE_FALSE_RE.search(text) and GAP_MARKERS_RE.search(text):
        consider("answer_area", 0.8, "rule:true_false_marks")
    elif TRUE_FALSE_RE.search(text) and len(text) < 80:
        consider("question", 0.72, "rule:true_false_prompt")

    # --- Gap markers. ---
    gaps = GAP_MARKERS_RE.findall(text)
    if gaps:
        gap_density = sum(len(g) for g in gaps) / max(len(text), 1)
        if gap_density > 0.25:
            consider("answer_area", 0.85, "rule:gap_dominant")
        else:
            consider("question", 0.76, "rule:gap_inline")

    # --- Question words. ---
    if QUESTION_WORD_RE.search(text) and "?" in text and len(text) < 300:
        consider("question", 0.74, "rule:question_word")

    return Classification(block.block_id, best_category, round(best_conf, 3), method, signals)


def _category_to_type(category: str) -> str | None:
    """Map an LLM category back onto the 16-type taxonomy."""
    mapping = {
        "exercise": "exercise",
        "instruction": "instruction",
        "question": "question",
        "answer_area": "answer_area",
        "image": "image",
        "table": "table",
        "paragraph": "paragraph",
        "header": "header",
        "footer": "footer",
        "caption": "caption",
        "reference": "unknown",  # ambiguous; keep layout hint
        "unknown": None,
    }
    return mapping.get(category)


_ALLOWED = ",".join(sorted(set(_TYPE_TO_CATEGORY.values())))


def _llm_classify_block(text: str) -> Classification | None:
    """Bounded LLM tie-break for low-confidence blocks."""
    try:
        from ..vision import _invoke_json

        result = _invoke_json(
            "Classify this textbook content snippet into exactly one category: "
            f"{_ALLOWED}. Language-learning textbooks (German A1). "
            'Return ONLY JSON: {"category": "...", "confidence": 0.0}. '
            f"Snippet: {text[:500]!r}"
        )
        if not result:
            return None
        category = str(result.get("category") or "").strip().lower()
        if category not in _TYPE_TO_CATEGORY.values():
            return None
        conf = max(0.0, min(1.0, float(result.get("confidence", 0.5))))
        return Classification("", category, conf, "llm", ["llm_tiebreak"])
    except Exception as exc:  # noqa: BLE001
        logger.debug("LLM classification failed: %s", exc)
        return None
