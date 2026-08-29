"""PyMuPDF-based extraction: layout reconstruction, text, and image extraction.

This replaces the pdfplumber-based extractor. PyMuPDF provides:
- Fast text extraction with bounding boxes (layout reconstruction)
- Image extraction from PDF pages
- Coordinate data for all text blocks and images

The extraction pipeline follows the staging defined in
``Context Files/Exercise_Extraction_Skill/Woodpacker_Extraction_Service.md``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any
from pathlib import Path

import pymupdf  # PyMuPDF

MAX_PAGES = 300
MAX_CHARS = 250_000


# ---------------------------------------------------------------------------
# Regex patterns (shared across stages)
# ---------------------------------------------------------------------------

PDF_PAGE_RE = re.compile(r"\[PAGE\s+(\d+)\]")

CHAPTER_RE = re.compile(
    r"^(chapter|unit|lesson|section|module|part|step|theme|topic|kapitel|lektion|"
    r"einheit|abschnitt|lecon|unite|chapitre|partie|leccion|unidad|"
    r"capitulo|parte)\s*[-\d.:]*\s+.+$",
    re.IGNORECASE,
)

EXERCISE_HEAD_RE = re.compile(
    r"^(exercise|task|activity|practice|worksheet|quiz|test|exam|aufgabe|ubung|arbeitsbuch|"
    r"exercice|activite|ejercicio|tarea)\s*[-\d.:]*",
    re.IGNORECASE,
)

QUESTION_ITEM_RE = re.compile(r"^(\d{1,3}[.)]|[a-z][.)])\s+.+")
QUESTION_HEAD_RE = QUESTION_ITEM_RE
ITEM_SPLIT_RE = re.compile(r"(\d{1,3}[.)])|[a-z][.)]")

SOLUTION_TEXT_RE = re.compile(
    r"\b(lösung|loesung|solutions?|antwort|answers?|schlüssel|schluessel|lehrerhandbuch|unterrichtshandbuch|handbuch)\b",
    re.IGNORECASE,
)

WORKBOOK_NAME_RE = re.compile(
    r"übungsbuch|ubungsbuch|arbeitsbuch|workbook|exercise ?book|practice ?book|arbeitsheft",
    re.IGNORECASE,
)
SOLUTION_NAME_RE = re.compile(r"lösung|loesung|solutions?|answer", re.IGNORECASE)
HANDBOOK_NAME_RE = re.compile(r"lehrer|teacher|unterrichtshandbuch|handbuch", re.IGNORECASE)
VOCAB_NAME_RE = re.compile(r"glossar|vokabel|wortschatz|grammatik|glossary", re.IGNORECASE)
EXAM_NAME_RE = re.compile(r"prüfung|klausur|exam|testbuch", re.IGNORECASE)
LESSON_NAME_RE = re.compile(r"kursbuch|coursebook|textbook|lehrbuch|schülerbuch|student", re.IGNORECASE)
EXERCISE_TEXT_RE = re.compile(r"aufgabe|übung|ubung|exercise|practice", re.IGNORECASE)

MEDIA_REF_RE = re.compile(
    r"(cd|track|spur|audio|video|film|hörtext|hör|hoertext|ausschnitt)\s*(\d+)(?:[\s.,\-–]+(\d+))?",
    re.IGNORECASE,
)

QVERBS = [
    "what", "where", "when", "why", "how", "complete", "fill", "choose", "translate",
    "describe", "schreiben", "wählen", "ergänzen", "übersetze", "nennen", "erklären",
]

# German exercise imperatives — an exercise does NOT need a question mark.
# Covers: "Kreuzen Sie an.", "Ergänzen Sie.", "Ordnen Sie zu.", "Schreiben Sie.",
# "Was passt?", "Welches Verb passt?", listening/speaking/writing prompts.
IMPERATIVE_EXERCISE_RE = re.compile(
    r"^\s*(?:\d{1,3}\s*[.)]\s*)?(?:"
    r"kreuzen sie|ergänzen sie|erganzen sie|ordnen sie|schreiben sie|lesen sie|"
    r"hören sie|hoeren sie|sehen sie|markieren sie|unterstreichen sie|setzen sie|"
    r"bilden sie|antworten sie|wählen sie|waehlen sie|beschreiben sie|erzählen sie|"
    r"erzaehlen sie|diskutieren sie|präsentieren sie|praesentieren sie|übersetzen sie|"
    r"uebersetzen sie|verbinden sie|berichten sie|nennen sie|kombinieren sie|"
    r"spielen sie|stellen sie|sprechen sie|suchen sie|finden sie|ergänzen sie|"
    r"was passt|wer passt|welche(r|s|n)?\s+[a-zäöüß]{3,25}\s+passt|"
    r"complete|choose|fill in|match|describe|write|listen and|read and|circle|underline"
    r")\b",
    re.IGNORECASE,
)

# Parenthetical verb/noun hints typical of fill-blank items: "Ich _____ (arbeiten) …"
GAP_HINT_RE = re.compile(r"\(\s*[a-zäöüß-]{2,25}\s*\)", re.IGNORECASE)

IMAGE_LINK_KEYWORDS = re.compile(r"bild|picture|abbildung|figure|bild\s*\d+|fig\.\s*\d+", re.IGNORECASE)

_WS_RE = re.compile(r"[ \t]+")
_NEWLINE_RE = re.compile(r"\n{3,}")

_NUM_HDR = re.compile(
    r"^(?:kapitel|lektion|lecon|unit|lesson|modul|chapter|section|part|thema|topic)\s*\d+[.:]?\s",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class TextSpan:
    """A text span with its bounding box coordinates."""
    text: str
    bbox: tuple[float, float, float, float]
    font_name: str = ""
    font_size: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "bbox": list(self.bbox),
            "font_name": self.font_name,
            "font_size": self.font_size,
        }


@dataclass
class LayoutBlock:
    """A layout block extracted from a PDF page with coordinates."""
    block_type: str  # "heading" | "text" | "exercise" | "image" | "audio_ref" | "video_ref"
    text: str
    bbox: tuple[float, float, float, float]
    page: int
    spans: list[TextSpan] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.block_type,
            "text": self.text,
            "bbox": list(self.bbox),
            "page": self.page,
            "spans": [s.to_dict() for s in self.spans],
        }


@dataclass
class ExtractedImage:
    """An image extracted from a PDF page."""
    image_id: str
    page: int
    bbox: tuple[float, float, float, float]
    ext: str  # "png" | "jpeg" | "jpg" etc.
    data: bytes
    description: str | None = None  # LLM vision description (Stage 3 enrichment)

    def to_dict(self) -> dict[str, Any]:
        return {
            "image_id": self.image_id,
            "page": self.page,
            "bbox": list(self.bbox),
            "ext": self.ext,
            "description": self.description,
            "_data_size": len(self.data),
        }


@dataclass
class FileEntry:
    file_id: str
    name: str
    path: str
    kind: str
    text: str
    page_count: int = 0
    word_count: int = 0
    blocks: list[LayoutBlock] = field(default_factory=list)
    images: list[ExtractedImage] = field(default_factory=list)
    is_scanned: bool = False
    ocr_engine: str = "pymupdf"


# ---------------------------------------------------------------------------
# File kind detection
# ---------------------------------------------------------------------------

def detect_kind(name: str) -> str:
    lower = name.lower()
    if lower.endswith(".pdf"):
        return "pdf"
    if lower.endswith((".epub", ".docx", ".pptx", ".doc", ".txt", ".md")):
        return "text"
    if lower.endswith((".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac")):
        return "audio"
    if lower.endswith((".mp4", ".mov", ".avi", ".mkv", ".webm")):
        return "video"
    if lower.endswith((".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp")):
        return "image"
    return "other"


# ---------------------------------------------------------------------------
# Stage 2: Layout Reconstruction (PyMuPDF)
# ---------------------------------------------------------------------------

def _clean_text(raw: str) -> str:
    """Clean text but preserve paragraph/newline structure for line-based detection."""
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    text = _WS_RE.sub(" ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()[:MAX_CHARS]


def extract_text(path: str) -> tuple[str, int]:
    """Return (text, page_count) from a PDF using PyMuPDF.

    Replaces the pdfplumber-based implementation. Text includes [PAGE n] markers.
    """
    p = Path(path)
    name = p.name.lower()
    page_count = 0
    text = ""

    if name.endswith(".pdf"):
        pages: list[str] = []
        try:
            doc = pymupdf.open(str(p))
            for i in range(min(doc.page_count, MAX_PAGES)):
                page = doc[i]
                page_text = page.get_text()
                if page_text:
                    pages.append(f"[PAGE {i + 1}]\n{page_text}")
            page_count = doc.page_count
            doc.close()
        except Exception:
            pass
        text = "\n".join(pages)
    elif name.endswith((".txt", ".md")):
        text = p.read_text(encoding="utf-8", errors="replace")
    elif name.endswith((".docx", ".pptx")):
        try:
            import docx
            text = " ".join(par.text for par in docx.Document(str(p)).paragraphs)
        except Exception:
            text = ""
    return _clean_text(text), page_count


def extract_layout(path: str) -> list[LayoutBlock]:
    """Stage 2: Layout Reconstruction using PyMuPDF.

    Extracts text blocks with bounding boxes from a PDF.
    Guarantees every page contributes at least one block: if a page has
    neither exercises nor text nor images detected, a fallback ``text``
    block (or image fallback) is synthesized so hovering boxes and the
    inspector never show an empty page when content exists. The block
    taxonomy is: heading | text | exercise | audio_ref | video_ref | image.
    """
    blocks: list[LayoutBlock] = []
    doc = pymupdf.open(str(path))

    for page_num in range(min(doc.page_count, MAX_PAGES)):
        page = doc[page_num]
        page_num_1indexed = page_num + 1
        page_blocks_start = len(blocks)

        # Get text blocks with structure
        text_dict = page.get_text("dict")
        for block in text_dict.get("blocks", []):
            if block.get("type") == 0:  # text block
                raw_bbox = block.get("bbox") or [0, 0, 0, 0]
                bbox = (float(raw_bbox[0]), float(raw_bbox[1]), float(raw_bbox[2]), float(raw_bbox[3]))
                span_list: list[TextSpan] = []
                full_text_parts: list[str] = []

                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        raw_span_bbox = span.get("bbox") or [0, 0, 0, 0]
                        # Ensure bbox is always 4 floats and within page rect.
                        sb = [float(v) for v in (list(raw_span_bbox) + [0, 0, 0, 0])[:4]]
                        # Clamp to page rect to avoid hover boxes outside page.
                        sb[0] = max(0.0, min(sb[0], page.rect.width))
                        sb[1] = max(0.0, min(sb[1], page.rect.height))
                        sb[2] = max(sb[0] + 1.0, min(sb[2], page.rect.width))
                        sb[3] = max(sb[1] + 1.0, min(sb[3], page.rect.height))
                        span_list.append(TextSpan(
                            text=span.get("text", ""),
                            bbox=(sb[0], sb[1], sb[2], sb[3]),
                            font_name=span.get("font", ""),
                            font_size=float(span.get("size", 0) or 0),
                        ))
                        full_text_parts.append(span.get("text", ""))

                text = "".join(full_text_parts).strip()
                if text:
                    # Clamp block bbox to page rect as well.
                    clamped_bbox: tuple[float, float, float, float] = (
                        max(0.0, min(bbox[0], page.rect.width)),
                        max(0.0, min(bbox[1], page.rect.height)),
                        max(float(bbox[0]) + 1.0, min(bbox[2], page.rect.width)),
                        max(float(bbox[1]) + 1.0, min(bbox[3], page.rect.height)),
                    )
                    # Skip degenerate blocks that would render as lines/dots.
                    if clamped_bbox[2] - clamped_bbox[0] < 2 or clamped_bbox[3] - clamped_bbox[1] < 2:
                        continue
                    block_type = _classify_block_type(text, clamped_bbox, span_list)
                    blocks.append(LayoutBlock(
                        block_type=block_type,
                        text=text,
                        bbox=clamped_bbox,
                        page=page_num_1indexed,
                        spans=span_list,
                    ))

        # Image blocks
        page_image_count = 0
        for img in page.get_images(full=True):
            xref = img[0]
            try:
                img_bbox = _get_image_bbox(page, xref)
                # Clamp image bbox to page rect.
                img_bbox = (
                    max(0.0, min(img_bbox[0], page.rect.width)),
                    max(0.0, min(img_bbox[1], page.rect.height)),
                    max(float(img_bbox[0]) + 1.0, min(img_bbox[2], page.rect.width)),
                    max(float(img_bbox[1]) + 1.0, min(img_bbox[3], page.rect.height)),
                )
                if img_bbox[2] - img_bbox[0] < 2 or img_bbox[3] - img_bbox[1] < 2:
                    continue
                # Skip tiny icon images (< 1.5% of page area) — decorative bullets.
                page_area = page.rect.width * page.rect.height
                box_area = (img_bbox[2] - img_bbox[0]) * (img_bbox[3] - img_bbox[1])
                if page_area > 0 and (box_area / page_area) < 0.015:
                    continue
                blocks.append(LayoutBlock(
                    block_type="image",
                    text="",
                    bbox=img_bbox,
                    page=page_num_1indexed,
                ))
                page_image_count += 1
            except Exception:
                pass

        # Per-page fallback: if we emitted nothing for this page but the page
        # has textual or visual content, synthesize at least one block so the
        # inspector/hover never shows an empty page.
        if len(blocks) == page_blocks_start:
            fallback_text = (page.get_text() or "").strip()
            if fallback_text:
                # Use the textual content's first 500 chars and a page-level bbox.
                snippet = fallback_text[:500].strip()
                # Place fallback in the upper text area, not full page.
                x0 = page.rect.width * 0.08
                x1 = page.rect.width * 0.92
                y0 = page.rect.height * 0.12
                y1 = page.rect.height * 0.30
                # If page is mostly images but get_text is weak, still treat as text.
                blocks.append(LayoutBlock(
                    block_type="text",
                    text=snippet,
                    bbox=(x0, y0, x1, y1),
                    page=page_num_1indexed,
                    spans=[],
                ))
            elif page_image_count == 0 and page.get_images(full=True):
                # Image-only page where image extraction was filtered as tiny —
                # keep one image marker so page is not empty.
                x0 = page.rect.width * 0.15
                x1 = page.rect.width * 0.85
                y0 = page.rect.height * 0.20
                y1 = page.rect.height * 0.80
                blocks.append(LayoutBlock(
                    block_type="image",
                    text="",
                    bbox=(x0, y0, x1, y1),
                    page=page_num_1indexed,
                ))

    doc.close()
    return blocks


def _classify_block_type(text: str, bbox: tuple[float, float, float, float], spans: list[TextSpan]) -> str:
    """Classify a text block into the 6 Woodpecker layout types.

    Returns one of: heading | text | exercise | audio_ref | video_ref
    (image is never returned here — image blocks are created separately).
    Mirrors the taxonomy the frontend inspector and hovering boxes expect:
    image, exercise, heading, text, audio_ref, video_ref.
    """
    raw = (text or "").strip()
    if not raw:
        return "text"
    first_line = raw.split("\n")[0].strip()

    # Standalone media references — must be checked before the generic
    # exercise heuristics so "Hören Sie Track 12." alone becomes audio_ref,
    # not an exercise. Exercises that ALSO contain a media ref stay as
    # exercises (checked below).
    stripped = first_line.strip()
    # Only treat a SHORT block (1-2 lines, < 120 chars) that is primarily a
    # media reference as audio_ref/video_ref — long paragraphs that merely
    # mention Track 12 are text/exercise, not a media ref block.
    is_short = len(raw) < 120 and raw.count("\n") <= 1
    if is_short and MEDIA_REF_RE.search(stripped):
        kind = "video" if re.search(r"\b(video|film|ausschnitt)\b", stripped, re.IGNORECASE) else "audio"
        # If the line is ONLY the media ref (e.g. "Hören Sie Track 12." or
        # "CD 1, Track 3") classify as media ref; otherwise let exercise
        # logic decide (e.g. "Ergänzen Sie. Hören Sie Track 12." is exercise).
        # Heuristic: media ref block has <= 12 words and no gap markers.
        words = stripped.split()
        has_gap = bool(GAP_HINT_RE.search(stripped) or "___" in stripped or "[ ]" in stripped)
        if len(words) <= 12 and not has_gap:
            return "video_ref" if kind == "video" else "audio_ref"

    # Heading detection — chapter/unit titles, numbered headers, or large font.
    if CHAPTER_RE.match(first_line) or _NUM_HDR.match(first_line):
        return "heading"
    # All-caps short titles are headings in many German textbooks (e.g. "INHALT", "GRAMMATIK").
    if is_short and len(first_line) >= 3 and first_line.isupper() and len(first_line) < 60:
        # Exclude single-letter gap markers like "A)".
        if not QUESTION_ITEM_RE.match(first_line):
            return "heading"
    if spans:
        try:
            font_size = max(s.font_size for s in spans if s.font_size > 0)
            # Large font + short line => heading even without keyword.
            if font_size > 14 and len(first_line) < 80 and len(first_line) >= 3:
                # Avoid classifying gap-fill lines with large rendered numbers as heading.
                if not (GAP_HINT_RE.search(raw) or QUESTION_ITEM_RE.match(first_line)):
                    return "heading"
        except ValueError:
            pass

    # Exercise detection — headers, German imperatives, gaps, questions.
    if EXERCISE_HEAD_RE.match(first_line) or QUESTION_ITEM_RE.match(first_line):
        return "exercise"
    # Check imperative in first 3 lines (covers multi-line headers like "Aufgabe 5a:\nKreuzen Sie an.")
    for ln in raw.split("\n")[:3]:
        if IMPERATIVE_EXERCISE_RE.match(ln):
            return "exercise"
        labeled = re.sub(r"^[^:]{0,40}:\s*", "", ln)
        if labeled != ln and IMPERATIVE_EXERCISE_RE.match(labeled):
            return "exercise"
    if GAP_HINT_RE.search(raw) or "___" in raw or "[ ]" in raw:
        # Gap hints inside a short numbered item are exercises.
        if QUESTION_ITEM_RE.match(first_line) or len(raw) < 300:
            return "exercise"
    if "?" in raw and len(raw) < 300 and len(first_line) < 120:
        # Questions that are not headings/chapters.
        if not (CHAPTER_RE.match(first_line) or _NUM_HDR.match(first_line)):
            # Avoid treating dialogue quotes as exercises.
            if len(words) >= 3:
                return "exercise"

    # Default: running text.
    return "text"


def _get_image_bbox(page: Any, xref: int) -> tuple[float, float, float, float]:
    """Get the bounding box of an image on a page.

    Falls back to a centered 35% sized rect instead of the full page so
    hovering boxes never span the entire page when rect lookup fails.
    """
    try:
        rects = page.get_image_rects(xref)
        if rects:
            r = rects[0]
            # Guard against degenerate zero-area rects.
            if r.x1 > r.x0 and r.y1 > r.y0:
                return (r.x0, r.y0, r.x1, r.y1)
    except Exception:
        pass
    # Fallback: centered rect covering ~35% of the page (not full page).
    w = page.rect.width
    h = page.rect.height
    # Keep within page bounds and preserve aspect: centered 60% width, 25% height.
    x0 = w * 0.20
    x1 = w * 0.80
    y0 = h * 0.30
    y1 = h * 0.55
    return (x0, y0, x1, y1)


# ---------------------------------------------------------------------------
# Stage 3: Image Extraction
# ---------------------------------------------------------------------------

def extract_images(path: str, file_id: str) -> list[ExtractedImage]:
    """Extract all images from a PDF using PyMuPDF.

    Returns a list of ExtractedImage with raw PNG bytes.
    """
    images: list[ExtractedImage] = []
    counter = 0
    doc = pymupdf.open(str(path))

    for page_num in range(min(doc.page_count, MAX_PAGES)):
        page = doc[page_num]
        page_num_1indexed = page_num + 1
        image_list = page.get_images(full=True)

        for img in image_list:
            xref = img[0]
            try:
                pix = pymupdf.Pixmap(doc, xref)
                if pix.n < 5:  # GRAY or RGB
                    img_data = pix.tobytes(output="png")
                else:  # CMYK - convert to RGB
                    pix_rgb = pymupdf.Pixmap(pymupdf.csRGB, pix)
                    img_data = pix_rgb.tobytes(output="png")
                    pix_rgb = None
                pix = None

                # Get bbox
                bbox = _get_image_bbox(page, xref)
                ext = "png"

                image_id = f"img_{file_id}_{counter:03d}"
                counter += 1

                images.append(ExtractedImage(
                    image_id=image_id,
                    page=page_num_1indexed,
                    bbox=bbox,
                    ext=ext,
                    data=img_data,
                ))
            except Exception:
                pass

    doc.close()
    return images


# Sampling budget for scanned-PDF detection: bounded, distributed across the
# whole document so a scanned cover/TOC no longer misclassifies a digital book.
SCAN_SAMPLE_PAGES = 12
_MIN_TEXT_CHARS = 20


def _sample_page_indices(page_count: int, max_samples: int = SCAN_SAMPLE_PAGES) -> list[int]:
    """Evenly distribute sample points: beginning → early/mid/late middle → end."""
    if page_count <= 0:
        return []
    if page_count <= max_samples:
        return list(range(page_count))
    # Include first and last page; spread the rest between them.
    step = (page_count - 1) / (max_samples - 1)
    return sorted({int(round(i * step)) for i in range(max_samples)})


def scan_profile(path: str) -> dict[str, Any]:
    """Analyze text presence per sampled page across the WHOLE document.

    Returns {page_count, sampled_pages, pages_with_text, scanned_ratio,
    is_scanned, textless_pages} where textless_pages are the sampled indices
    (0-based) without meaningful text.
    """
    doc = pymupdf.open(str(path))
    try:
        page_count = doc.page_count
        sample = _sample_page_indices(page_count)
        pages_with_text = 0
        textless_pages: list[int] = []
        for idx in sample:
            text = doc[idx].get_text().strip()
            if len(text) > _MIN_TEXT_CHARS:
                pages_with_text += 1
            else:
                textless_pages.append(idx)
        scanned_ratio = 1.0 - (pages_with_text / len(sample)) if sample else 0.0
        return {
            "page_count": page_count,
            "sampled_pages": len(sample),
            "pages_with_text": pages_with_text,
            "scanned_ratio": round(scanned_ratio, 3),
            "is_scanned": bool(sample) and scanned_ratio >= 0.5,
            "textless_pages": textless_pages,
        }
    finally:
        doc.close()


def is_scanned_pdf(path: str) -> bool:
    """True when the majority of a document-wide sample has no text layer.

    Replaces the old first-5-pages heuristic which misclassified books whose
    cover/table-of-contents were scanned images.
    """
    return scan_profile(path)["is_scanned"]


# ---------------------------------------------------------------------------
# Stage 1: Document Classification
# ---------------------------------------------------------------------------

def classify_file(entry: FileEntry) -> tuple[str, float]:
    """Stage 1: Document Classification.

    Returns (material_type, confidence) where material_type is one of:
    lesson_book, exercise_book, workbook, solution_book, teacher_handbook,
    audio, video, transcript, vocabulary_book, exam_book, grammar_reference,
    worksheet, other.
    """
    kind = entry.kind
    if kind == "audio":
        return ("audio", 0.95)
    if kind == "video":
        return ("video", 0.95)
    if kind == "image":
        return ("other", 0.6)
    if kind not in ("pdf", "text", "docx", "epub", "pptx", "other"):
        return ("other", 0.3)

    name = entry.name.lower()
    text = entry.text.lower()

    if SOLUTION_NAME_RE.search(name):
        return ("solution_book", 0.85)
    if HANDBOOK_NAME_RE.search(name):
        return ("teacher_handbook", 0.8)
    if WORKBOOK_NAME_RE.search(name):
        return ("workbook", 0.8)
    if VOCAB_NAME_RE.search(name):
        return ("vocabulary_book", 0.7)
    if EXAM_NAME_RE.search(name):
        return ("exam_book", 0.7)
    if LESSON_NAME_RE.search(name):
        return ("lesson_book", 0.8)

    # Content-based fallbacks
    if SOLUTION_TEXT_RE.search(text[:2000]):
        return ("solution_book", 0.75)
    if EXERCISE_TEXT_RE.search(text[:2000]):
        return ("exercise_book", 0.75)
    return ("lesson_book", 0.5)


# ---------------------------------------------------------------------------
# Stage 5: Exercise Extraction
# ---------------------------------------------------------------------------

def detect_exercises(text: str) -> list[dict]:
    """Stage 5: Exercise Extraction.

    Returns exercise-like blocks as {prompt, page, name}.
    Boundary rules:
    - headers (Aufgabe/Übung/Kapitel/numbered) always start a new candidate;
    - German imperative lines start a new candidate ONLY when the current
      block already looks complete — sub-instructions inside one exercise
      stay together;
    - multi-page exercises keep their page RANGE ("S. 5-6").
    """
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    exercises: list[dict] = []
    current: list[str] = []
    current_page: str | None = None
    last_page: str | None = None
    current_name: str | None = None

    def _is_instruction_line(line: str | None) -> bool:
        """Exercise instructions join the prompt; chapter titles do not."""
        if not line:
            return False
        if EXERCISE_HEAD_RE.match(line):
            return True
        labeled = re.sub(r"^[^:]{0,40}:\s*", "", line)
        return bool(
            IMPERATIVE_EXERCISE_RE.match(line) or IMPERATIVE_EXERCISE_RE.match(labeled)
        )

    def flush() -> None:
        if not current:
            return
        # Prompt includes the instruction/header line so imperatives like
        # "Aufgabe 5a: Kreuzen Sie an." travel with the exercise (mirrors the
        # LLM path). Chapter/section titles ("Kapitel 1: Sie oder du?")
        # stay OUT of the prompt — they are names, never task text.
        header_lines = [current_name] if _is_instruction_line(current_name) else []
        full = header_lines + current
        if _looks_like_question(full):
            page = current_page
            if current_page and last_page and current_page != last_page:
                start = re.search(r"(\d+)", current_page)
                end = re.search(r"(\d+)", last_page)
                if start and end:
                    page = f"S. {start.group(1)}-{end.group(1)}"
            exercises.append({
                "prompt": "\n".join(full),
                "page": page,
                "name": current_name or "",
            })

    for line in lines:
        m = PDF_PAGE_RE.match(line)
        if m:
            last_page = f"S. {m.group(1)}"
            if current_page is None:
                current_page = last_page
            continue
        is_header = EXERCISE_HEAD_RE.match(line) or CHAPTER_RE.match(line) or _NUM_HDR.match(line)
        # Imperative boundary: only split when the buffer already holds a
        # plausible exercise (prevents fragmenting multi-instruction blocks).
        is_imperative_boundary = (
            bool(current)
            and IMPERATIVE_EXERCISE_RE.match(line) is not None
            and _looks_like_question(current)
        )
        if is_header or is_imperative_boundary:
            flush()
            current = []
            if is_header:
                current_name = line
            elif current_name is None:
                current_name = line[:60]
            if last_page:
                current_page = last_page
        else:
            current.append(line)
    flush()
    return exercises[:50]


def _looks_like_question(lines: list[str]) -> bool:
    if not lines:
        return False
    first = lines[0]
    body = " ".join(lines).lower()
    if len(first) < 4:
        return False
    # German imperatives ("Kreuzen Sie an.") — no question mark required.
    # Labels like "Aufgabe 7:" are stripped before matching.
    for line in lines[:3]:
        if IMPERATIVE_EXERCISE_RE.match(line):
            return True
        labeled = re.sub(r"^[^:]{0,40}:\s*", "", line)
        if labeled != line and IMPERATIVE_EXERCISE_RE.match(labeled):
            return True
    if "?" in body or "___" in body or "[ ]" in body or QUESTION_HEAD_RE.match(first):
        return True
    # Fill-blank items with parenthetical hints: "1. Ich _____ (arbeiten) …"
    if GAP_HINT_RE.search(body) and re.match(r"\d{1,3}[.)]", first):
        return True
    return any(v in body for v in QVERBS)


# ---------------------------------------------------------------------------
# Stage 6: Question Decomposition
# ---------------------------------------------------------------------------

def extract_exercise_items(exercise_id: str, prompt: str) -> list[dict]:
    """Stage 6: Question Decomposition.

    Split a multi-question prompt into individual learner-facing items.
    """
    lines = [l.strip() for l in (prompt or "").splitlines() if l.strip()]
    if not lines:
        return []

    items: list[dict] = []
    current: list[str] = []
    pos = 0
    current_answer: str | None = None

    def flush() -> None:
        nonlocal current, pos, current_answer
        if current and pos > 0:
            items.append({
                "exercise_item_id": f"{exercise_id}-q{pos}",
                "exercise_id": exercise_id,
                "question": " ".join(current).strip(),
                "answer": current_answer,
                "position": pos,
            })
        current = []
        current_answer = None

    for line in lines:
        if QUESTION_HEAD_RE.match(line):
            flush()
            pos += 1
            current = [re.sub(r"^(?:\d{1,3}[.)]|[a-z][.\)])\s+", "", line)]
        elif SOLUTION_TEXT_RE.search(line):
            current_answer = (current_answer or "") + (" " + line if current_answer else line)
        elif current:
            current.append(line)
    flush()

    if not items:
        items.append({
            "exercise_item_id": f"{exercise_id}-q1",
            "exercise_id": exercise_id,
            "question": prompt.strip(),
            "answer": None,
            "position": 1,
        })
    return items


# ---------------------------------------------------------------------------
# Stage 8: Audio/ Media Reference Detection
# ---------------------------------------------------------------------------

def detect_media_refs(text: str) -> list[tuple[str, list[int]]]:
    """Detect audio/video references in text."""
    out: list[tuple[str, list[int]]] = []
    for m in MEDIA_REF_RE.finditer(text):
        keyword = m.group(1).lower()
        numbers = [int(m.group(2))] if m.group(2) else []
        if m.group(3):
            numbers.append(int(m.group(3)))
        kind = "video" if keyword in ("video", "film", "ausschnitt") else "audio"
        out.append((kind, numbers))
    return out


def match_media_number(name: str, numbers: list[int]) -> bool:
    """Match media file name against reference numbers."""
    base = re.sub(r"\.[^.]+$", "", name).lower()
    if not numbers:
        return False
    first = numbers[0]
    m = re.search(r"(track|lektion|kapitel|chapter|unit|lesson|audio|cd|dvd)[^0-9]*(\d+)", base)
    if m and int(m.group(2)) == first:
        return True
    m2 = re.search(r"[^0-9](\d{1,3})$", base)
    return bool(m2) and int(m2.group(1)) == first


def chapter_number(title: str) -> str | None:
    m = re.search(r"(\d+(?:[.\-]\d+)?)", title)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------
# Exercise type classification (heuristic; LLM refinement lives in vision.py)
# ---------------------------------------------------------------------------

EXERCISE_TYPE_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("multiple_choice", ("wählen sie", "kreuzen sie", "welche antwort", "a)", "b)", "c)", "richtig oder falsch", "multiple choice")),
    ("listening", ("hören", "hoeren", "track", "cd ", "hörtext", "hoertext", "zuhören", "zuhoeren", "anhören", "anhoeren", "audio")),
    ("video_comprehension", ("video", "film", "ausschnitt", "ansehen", "schauen sie sich")),
    ("reading_comprehension", ("lesen sie", "text lesen", "leseverstehen", "artikel", "geschichte")),
    ("translation", ("übersetzen", "uebersetzen", "übersetzung", "uebersetzung", "translate", "translation")),
    ("matching", ("ordnen", "zuordnen", "verbinden", "matching", "paare", "paaren")),
    ("sentence_building", ("sätze", "saetze", "satz", "bilden sie", "reihenfolge", "wörter ordnen", "woerter ordnen", "sentence")),
    ("vocabulary", ("vokabeln", "wortschatz", "wörter", "woerter", "begriffe", "glossar", "vocabulary")),
    ("grammar", ("grammatik", "grammar", "präsens", "präteritum", "perfekt", "konjugation", "deklination", "adjektiv", "artikel")),
    ("dialogue_completion", ("dialog", "dialogue", "gespräch", "gespraech", "rolle", "rollenspiel")),
    ("speaking", ("sprechen", "erzählen", "erzaehlen", "antworten sie", "diskutieren", "berichten", "präsentieren", "praesentieren", "describe", "beschreiben", "speaking")),
    ("pronunciation", ("aussprache", "betonung", "intonation", "nachsprechen", "pronunciation")),
    ("writing", ("schreiben", "aufsatz", "brief", "e-mail", "email", "zusammenfassung", "writing")),
    ("fill_blank", ("ergänzen", "ergaenzen", "ergänzen sie", "lücken", "luecken", "einsetzen", "setzen sie ein", "fill", "_____", "___")),
)


def classify_exercise_type_heuristic(text: str) -> str:
    """Heuristic exercise type classification (no LLM).

    Returns one of the spec exercise types, defaulting to "open_ended".
    """
    lower = (text or "").lower()
    for ex_type, keywords in EXERCISE_TYPE_KEYWORDS:
        for kw in keywords:
            if len(kw.split()) == 1 and len(kw) <= 8:
                pattern = re.compile(rf"(?<![a-zäöüß]){re.escape(kw)}(?![a-zäöüß])")
                if pattern.search(lower):
                    return ex_type
            elif kw in lower:
                return ex_type
    return "open_ended"


def classify_exercise_type(exercise_prompt: str) -> str:
    """Classify an exercise prompt into a spec exercise type.

    Uses the heuristic first; refines with the LLM (vision.py) when the
    heuristic is inconclusive ("open_ended") and an API key is configured.
    Never raises; falls back to "open_ended".
    """
    heuristic = classify_exercise_type_heuristic(exercise_prompt or "")
    if heuristic != "open_ended":
        return heuristic
    try:
        from .vision import classify_exercise_type as _llm_classify

        result = _llm_classify(exercise_prompt or "")
        if result:
            return result["exercise_type"]
    except Exception:  # noqa: BLE001
        pass
    return heuristic


# ---------------------------------------------------------------------------
# Cross-file relationship helpers
# ---------------------------------------------------------------------------

def _extract_exercise_number(text: str) -> str | None:
    """Extract exercise number from text (e.g., 'Aufgabe 5a' -> '5a')."""
    patterns = [
        r"aufgabe\s*(\d+[a-z]?)",
        r"exercise\s*(\d+[a-z]?)",
        r"aufg\.\s*(\d+[a-z]?)",
        r"ex\.\s*(\d+[a-z]?)",
        r"task\s*(\d+[a-z]?)",
        r"(\d+[a-z]?)\s*[.)]",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)
    return None


def _detect_solution_refs(text: str) -> list[int]:
    """Detect solution page references in text."""
    patterns = [
        r"lösung\s+(?:seite|page)\s*(\d+)",
        r"loesung\s+(?:seite|page)\s*(\d+)",
        r"solution\s+(?:page|p\.)\s*(\d+)",
    ]
    pages = []
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            if match.group(1):
                pages.append(int(match.group(1)))
    return list(set(pages))
