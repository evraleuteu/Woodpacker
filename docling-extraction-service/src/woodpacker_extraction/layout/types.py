"""Canonical document model for the layout-first pipeline.

Every stage consumes/produces these types. Coordinates are mandatory:
all bboxes are ``(x1, y1, x2, y2)`` in PIXELS of the rendered page image
(``RENDER_DPI``, default 200), so crops and inspector overlays align exactly.

Determinism contract: identical input PDF + provider order => byte-identical
JSON output (stable ids, sorted keys where ordering is not semantic).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any

RENDER_DPI = int(os.environ.get("RENDER_DPI", "200"))

# ---------------------------------------------------------------------------
# Block taxonomy (Stage 2 spec)
# ---------------------------------------------------------------------------

BLOCK_TYPES: tuple[str, ...] = (
    "title",
    "subtitle",
    "paragraph",
    "exercise",
    "instruction",
    "question",
    "answer_area",
    "image",
    "table",
    "header",
    "footer",
    "audio_reference",
    "video_reference",
    "page_number",
    "caption",
    "unknown",
    # --- Hierarchical atomic taxonomy (new) ---
    "text",
    "label",
    "list",
    "list_item",
    "answer",
    "table_cell",
    "illustration",
    "photo",
    "diagram",
    "qr_code",
    "barcode",
    "audio_marker",
    "video_marker",
    "icon",
    "logo",
    "design_element",
    "level_badge",
    "section_marker",
    "decorative_shape",
    "background",
    "page_decoration",
    "media_marker",
)


class BlockType:
    """String constants for the block types (JSON-safe)."""

    TITLE = "title"
    SUBTITLE = "subtitle"
    PARAGRAPH = "paragraph"
    EXERCISE = "exercise"
    INSTRUCTION = "instruction"
    QUESTION = "question"
    ANSWER_AREA = "answer_area"
    IMAGE = "image"
    TABLE = "table"
    HEADER = "header"
    FOOTER = "footer"
    AUDIO_REFERENCE = "audio_reference"
    VIDEO_REFERENCE = "video_reference"
    PAGE_NUMBER = "page_number"
    CAPTION = "caption"
    UNKNOWN = "unknown"
    # atomic/visual taxonomy
    TEXT = "text"
    LABEL = "label"
    LIST = "list"
    LIST_ITEM = "list_item"
    ANSWER = "answer"
    TABLE_CELL = "table_cell"
    ILLUSTRATION = "illustration"
    PHOTO = "photo"
    DIAGRAM = "diagram"
    QR_CODE = "qr_code"
    BARCODE = "barcode"
    AUDIO_MARKER = "audio_marker"
    VIDEO_MARKER = "video_marker"
    ICON = "icon"
    LOGO = "logo"
    DESIGN_ELEMENT = "design_element"
    LEVEL_BADGE = "level_badge"
    SECTION_MARKER = "section_marker"
    DECORATIVE_SHAPE = "decorative_shape"
    BACKGROUND = "background"
    PAGE_DECORATION = "page_decoration"
    MEDIA_MARKER = "media_marker"


VALID_BLOCK_TYPES = frozenset(BLOCK_TYPES)

# Exercise type taxonomy (Stage 9 spec)
EXERCISE_TYPES: tuple[str, ...] = (
    "multiple_choice",
    "fill_blank",
    "matching",
    "ordering",
    "listening",
    "speaking",
    "reading",
    "writing",
    "dialogue",
    "image_description",
    "grammar",
    "vocabulary",
    "true_false",
    "drag_drop",
    "open_question",
)


class ExerciseType:
    MULTIPLE_CHOICE = "multiple_choice"
    FILL_BLANK = "fill_blank"
    MATCHING = "matching"
    ORDERING = "ordering"
    LISTENING = "listening"
    SPEAKING = "speaking"
    READING = "reading"
    WRITING = "writing"
    DIALOGUE = "dialogue"
    IMAGE_DESCRIPTION = "image_description"
    GRAMMAR = "grammar"
    VOCABULARY = "vocabulary"
    TRUE_FALSE = "true_false"
    DRAG_DROP = "drag_drop"
    OPEN_QUESTION = "open_question"


VALID_EXERCISE_TYPES = frozenset(EXERCISE_TYPES)

# ---------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------

BBox = tuple[float, float, float, float]


def clamp_bbox(bbox: BBox, width: float, height: float) -> BBox:
    """Clamp a bbox to the page rect; guarantees x2>x0, y2>y0."""
    x0 = max(0.0, min(float(bbox[0]), width - 1.0))
    y0 = max(0.0, min(float(bbox[1]), height - 1.0))
    x1 = max(x0 + 1.0, min(float(bbox[2]), width))
    y1 = max(y0 + 1.0, min(float(bbox[3]), height))
    return (x0, y0, x1, y1)


def bbox_area(bbox: BBox) -> float:
    return max(0.0, bbox[2] - bbox[0]) * max(0.0, bbox[3] - bbox[1])


def bbox_intersection(a: BBox, b: BBox) -> float:
    x0 = max(a[0], b[0])
    y0 = max(a[1], b[1])
    x1 = min(a[2], b[2])
    y1 = min(a[3], b[3])
    if x1 <= x0 or y1 <= y0:
        return 0.0
    return (x1 - x0) * (y1 - y0)


# ---------------------------------------------------------------------------
# Core models
# ---------------------------------------------------------------------------


@dataclass
class TextSpan:
    text: str
    bbox: BBox
    font_name: str = ""
    font_size: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "bbox": [round(v, 2) for v in self.bbox],
            "font_name": self.font_name,
            "font_size": round(self.font_size, 2),
        }


@dataclass
class LayoutBlock:
    """A detected visual element with mandatory coordinates.

    ``block_id`` format: ``page_{page:03d}_block_{idx:03d}`` (e.g.
    ``page_025_block_014``) — deterministic per page ordering.

    Hierarchical extension (atomic pipeline):
      - parentId: coarse parent when this block is an atomic child (line/span)
      - children: child block ids (when this is a coarse semantic group)
      - readingOrder: global reading order index after reconstruction
      - subtype: precise subtype (level_badge etc.) when type is generic
      - provenance: list of detectors that contributed (pdf, ocr, layout)
    """

    block_id: str
    page: int
    type: str
    bbox: BBox
    confidence: float
    text: str = ""
    source: str = ""  # provider that produced the region ("pymupdf", "surya", ...)
    spans: list[TextSpan] = field(default_factory=list)
    meta: dict[str, Any] = field(default_factory=dict)
    # hierarchical fields (optional for backwards compat)
    parent_id: str | None = None
    children: list[str] = field(default_factory=list)
    reading_order: int | None = None
    subtype: str | None = None
    provenance: list[str] = field(default_factory=list)
    detectors: list[str] = field(default_factory=list)

    def to_dict(self, include_spans: bool = True) -> dict[str, Any]:
        out: dict[str, Any] = {
            "block_id": self.block_id,
            "page": self.page,
            "type": self.type,
            "bbox": [round(v, 2) for v in self.bbox],
            "confidence": round(self.confidence, 3),
        }
        if self.text:
            out["text"] = self.text
        if include_spans and self.spans:
            out["spans"] = [s.to_dict() for s in self.spans]
        if self.source:
            out["source"] = self.source
        if self.meta:
            out["meta"] = self.meta
        # hierarchical (only when present to keep JSON small but explicit)
        if self.parent_id:
            out["parentId"] = self.parent_id
        if self.children:
            out["children"] = self.children
        if self.reading_order is not None:
            out["readingOrder"] = self.reading_order
        if self.subtype:
            out["subtype"] = self.subtype
        if self.provenance:
            out["provenance"] = self.provenance
        if self.detectors:
            out["detectors"] = self.detectors
        return out


@dataclass
class OcrText:
    """Per-block OCR output (never whole-page)."""

    block_id: str
    text: str
    confidence: float
    engine: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "block_id": self.block_id,
            "text": self.text,
            "confidence": round(self.confidence, 3),
            "engine": self.engine,
        }


@dataclass
class PageModel:
    """Stage 1 output for one page."""

    page: int
    width: int
    height: int
    blocks: list[LayoutBlock] = field(default_factory=list)
    has_text_layer: bool = True
    render_dpi: int = RENDER_DPI

    def to_dict(self, include_blocks: bool = True) -> dict[str, Any]:
        out: dict[str, Any] = {
            "page": self.page,
            "width": self.width,
            "height": self.height,
            "has_text_layer": self.has_text_layer,
            "render_dpi": self.render_dpi,
        }
        if include_blocks:
            out["blocks"] = [b.to_dict() for b in self.blocks]
        return out


@dataclass
class Classification:
    """Stage 5 output: rules-first classification of one block."""

    block_id: str
    category: str  # exercise | instruction | question | answer_area | image | table |
    # paragraph | header | footer | caption | reference | unknown
    confidence: float
    method: str  # "rules" | "llm" | "layout" | "geometry"
    signals: list[str] = field(default_factory=list)

    # Categories from the Stage 5 spec (a superset view of block types).
    CATEGORIES: tuple[str, ...] = (
        "exercise",
        "instruction",
        "question",
        "answer_area",
        "image",
        "table",
        "paragraph",
        "header",
        "footer",
        "caption",
        "reference",
        "unknown",
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "block_id": self.block_id,
            "category": self.category,
            "confidence": round(self.confidence, 3),
            "method": self.method,
            "signals": self.signals,
        }


@dataclass
class ImageUnderstanding:
    """Stage 6 output — vision applied ONLY to image blocks."""

    image_id: str
    description: str
    keywords: list[str]
    engine: str = "vision"

    def to_dict(self) -> dict[str, Any]:
        return {
            "image_id": self.image_id,
            "description": self.description,
            "keywords": self.keywords,
            "engine": self.engine,
        }


@dataclass
class AudioReference:
    """A track/audio cue referenced by content (e.g. 'CD 1, Track 03')."""

    ref_id: str  # canonical: "track_{n}" when numbered, else hash-based
    track: int | None
    cd: int | None
    kind: str = "audio"  # audio | video
    raw_text: str = ""
    block_ids: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ref_id": self.ref_id,
            "track": self.track,
            "cd": self.cd,
            "kind": self.kind,
            "raw_text": self.raw_text,
            "block_ids": self.block_ids,
        }


@dataclass
class Relationship:
    """A directed edge between blocks/exercises/media (Stage 7)."""

    relationship: str  # BELONGS_TO | HAS_INSTRUCTION | HAS_QUESTION | HAS_IMAGE |
    # HAS_AUDIO | HAS_SOLUTION | RELATED_TO | PRECEDES
    from_ref: str
    to_ref: str
    confidence: float
    rationale: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "relationship": self.relationship,
            "from": self.from_ref,
            "to": self.to_ref,
            "confidence": round(self.confidence, 3),
            "rationale": self.rationale,
        }


@dataclass
class Exercise:
    """A grouped exercise region (Stage 9/10)."""

    exercise_id: str
    page_start: int
    page_end: int
    bbox: BBox
    instruction_block: str | None
    question_blocks: list[str]
    image_blocks: list[str]
    audio_references: list[str]  # AudioReference ids
    solution_blocks: list[str]
    answer_area_blocks: list[str]
    exercise_type: str
    type_confidence: float
    name: str = ""
    prompt: str = ""
    confidence: float = 0.5
    signals: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.exercise_id,
            "name": self.name,
            "pages": [self.page_start, self.page_end],
            "bbox": [round(v, 2) for v in self.bbox],
            "instruction": self.prompt or None,
            "instruction_block": self.instruction_block,
            "question_blocks": self.question_blocks,
            "image_blocks": self.image_blocks,
            "audio_references": self.audio_references,
            "solution_blocks": self.solution_blocks,
            "answer_area_blocks": self.answer_area_blocks,
            "questions": self.questions(),
            "exercise_type": self.exercise_type,
            "confidence": round(self.confidence, 3),
            "type_confidence": round(self.type_confidence, 3),
            "signals": self.signals,
        }

    def questions(self) -> list[str]:
        """Question texts resolved by the caller (kept empty here)."""
        return []


@dataclass
class SemanticGroup:
    """Higher-level grouping of atomic elements (exercise, lesson section).

    Preserves atomicElements separately — grouping is additive.
    """

    id: str
    type: str  # exercise | section | column | table | lesson
    member_ids: list[str] = field(default_factory=list)
    bbox: BBox = (0, 0, 0, 0)
    confidence: float = 0.0
    label: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "member_ids": self.member_ids,
            "bbox": [round(v, 2) for v in self.bbox],
            "confidence": round(self.confidence, 3),
            "label": self.label,
        }


@dataclass
class DocumentBundle:
    """The full structured result of the pipeline for ONE file."""

    file_id: str
    filename: str
    sha256: str
    page_count: int
    pages: list[PageModel] = field(default_factory=list)
    ocr: list[OcrText] = field(default_factory=list)
    classifications: list[Classification] = field(default_factory=list)
    images: list[ImageUnderstanding] = field(default_factory=list)
    audio_refs: list[AudioReference] = field(default_factory=list)
    relationships: list[Relationship] = field(default_factory=list)
    knowledge_graph: dict[str, Any] = field(default_factory=dict)
    exercises: list[Exercise] = field(default_factory=list)
    reading_order: list[str] = field(default_factory=list)  # ordered block ids across doc
    artifacts: dict[str, Any] = field(default_factory=dict)  # storage paths
    telemetry: list[dict[str, Any]] = field(default_factory=list)
    quality: dict[str, Any] = field(default_factory=dict)
    providers_used: dict[str, str] = field(default_factory=dict)  # stage -> provider
    llm_calls: int = 0
    # hierarchical atomic pipeline extension
    atomic_elements: list[LayoutBlock] = field(default_factory=list)
    semantic_groups: list[SemanticGroup] = field(default_factory=list)
    debug_layers: dict[str, Any] = field(default_factory=dict)
    evaluation: dict[str, Any] = field(default_factory=dict)

    def all_blocks(self) -> list[LayoutBlock]:
        return [b for p in self.pages for b in p.blocks]

    def to_dict(self) -> dict[str, Any]:
        return {
            "file_id": self.file_id,
            "filename": self.filename,
            "sha256": self.sha256,
            "page_count": self.page_count,
            "providers_used": self.providers_used,
            "llm_calls": self.llm_calls,
            "pages": [p.to_dict() for p in self.pages],
            "ocr": [o.to_dict() for o in self.ocr],
            "classifications": [c.to_dict() for c in self.classifications],
            "images": [i.to_dict() for i in self.images],
            "audio_references": [a.to_dict() for a in self.audio_refs],
            "relationships": [r.to_dict() for r in self.relationships],
            "knowledge_graph": self.knowledge_graph,
            "exercises": [e.to_dict() for e in self.exercises],
            "reading_order": self.reading_order,
            "artifacts": self.artifacts,
            "quality": self.quality,
            "telemetry": self.telemetry,
            # hierarchical layers — new but backwards compatible
            "atomicElements": [b.to_dict() for b in self.atomic_elements] if self.atomic_elements else [],
            "semanticGroups": [g.to_dict() for g in self.semantic_groups] if self.semantic_groups else [],
            "debugLayers": self.debug_layers,
            "evaluation": self.evaluation,
        }
