"""Pydantic models for the Woodpacker Extraction Service output schema.

These models implement the output schema described in
``Context Files/Exercise_Extraction_Skill/Woodpacker_Extraction_Service.md``.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

MaterialType = Literal[
    "lesson_book",
    "exercise_book",
    "workbook",
    "solution_book",
    "teacher_handbook",
    "audio",
    "video",
    "transcript",
    "vocabulary_book",
    "exam_book",
    "grammar_reference",
    "worksheet",
    "other",
]

ExerciseType = Literal[
    "multiple_choice",
    "fill_blank",
    "listening",
    "video_comprehension",
    "reading_comprehension",
    "matching",
    "sentence_building",
    "translation",
    "vocabulary",
    "grammar",
    "dialogue_completion",
    "speaking",
    "pronunciation",
    "writing",
    "open_ended",
]

# The 8 flashcard-ready types (VALID_EXERCISE_TYPES in exercise-validation.ts).
FlashcardType = Literal[
    "fill-blank",
    "multiple-choice",
    "translation",
    "recall",
    "pattern-drill",
    "roleplay",
    "comprehension",
    "assessment",
]

RelType = Literal[
    "exercise_to_audio",
    "exercise_to_video",
    "exercise_to_solution",
    "exercise_to_reading",
    "chapter_match",
    "exercise_number_match",
    "image_link",
]

NodeType = Literal["exercise", "audio", "video", "solution", "chapter", "image", "question", "knowledge_unit"]


class MaterialClassification(BaseModel):
    model_config = ConfigDict(extra="forbid")
    file_id: str
    file_name: str
    file_type: MaterialType
    confidence: float = Field(..., ge=0.0, le=1.0)


class LayoutBlockModel(BaseModel):
    """A layout block with coordinates from PDF layout reconstruction."""
    model_config = ConfigDict(extra="forbid")
    type: str  # "heading" | "text" | "exercise" | "image" | "audio_ref" | "video_ref"
    text: str
    bbox: list[float] = Field(..., min_length=4, max_length=4)
    page: int
    spans: list[dict] = Field(default_factory=list)


class ExtractedImageModel(BaseModel):
    """An image extracted from a PDF page."""
    model_config = ConfigDict(extra="forbid")
    image_id: str
    page: int
    bbox: list[float] = Field(..., min_length=4, max_length=4)
    ext: str
    description: Optional[str] = None


class ExerciseRef(BaseModel):
    """A chapter-level exercise (a category/title), NOT a flashcard."""
    model_config = ConfigDict(extra="forbid")
    exercise_id: str
    chapter: str
    section: str
    exercise_title: str
    exercise_type: ExerciseType
    page: int


class ExerciseItem(BaseModel):
    """An individual learner-facing question — the actual flashcard source."""
    model_config = ConfigDict(extra="forbid")
    exercise_item_id: str
    exercise_id: str
    question: str
    answer: Optional[str] = None
    position: int
    page: Optional[str] = None
    linked_images: list[str] = Field(default_factory=list)
    linked_audio: list[str] = Field(default_factory=list)


class FlashcardExercise(BaseModel):
    """A validated, flashcard-ready exercise (mirrors the Next.js Exercise type).

    Produced by the re-done exercise extraction (LLM discovery + heuristic
    fallback) after passing every rejection gate in
    :mod:`woodpacker_extraction.validation`. Shapes map 1:1 onto
    ``src/lib/types.ts`` ``Exercise`` in the Woodpecker app.
    """

    model_config = ConfigDict(extra="forbid")
    id: str
    type: FlashcardType
    prompt: str
    answer: Optional[str] = None
    options: list[str] = Field(default_factory=list)
    page: Optional[str] = None
    name: Optional[str] = None
    source: str = ""  # file id / asset id the exercise was extracted from
    page_number: Optional[int] = None
    required_audio: list[str] = Field(default_factory=list)
    required_video: list[str] = Field(default_factory=list)
    solutions: list[str] = Field(default_factory=list)


class ResourceLink(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")
    relationship: RelType
    from_: str = Field(alias="from")
    to: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    rationale: str


class KnowledgeNode(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    type: NodeType
    label: str


class KnowledgeLink(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")
    from_: str = Field(alias="from")
    to: str
    type: RelType
    confidence: float = Field(..., ge=0.0, le=1.0)


class KnowledgeGraph(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nodes: list[KnowledgeNode]
    links: list[KnowledgeLink]


class QualityReport(BaseModel):
    model_config = ConfigDict(extra="forbid")
    exercises_extracted: int
    orphan_audio: int
    orphan_video: int
    duplicate_exercises: int
    missing_solutions: int
    issues: list[str]


class LearningMaterialGraph(BaseModel):
    """The full structured output of the Learning Material Intelligence Agent.

    Exercise titles are categories, never flashcards. Flashcards are generated
    exclusively from `items`.

    Output schema (from Woodpacker_Extraction_Service.md):
    {
      "course": {}, "chapters": [], "lessons": [], "topics": [],
      "grammar_rules": [], "vocabulary": [], "images": [], "audio": [],
      "exercises": [], "questions": [], "answers": [], "relationships": []
    }
    """

    model_config = ConfigDict(extra="forbid")

    # Original schema fields
    classifications: list[MaterialClassification]
    exercises: list[ExerciseRef]
    items: list[ExerciseItem]
    resourceLinks: list[ResourceLink]
    knowledgeGraph: KnowledgeGraph
    quality: QualityReport

    # New exercise extraction output — validated, flashcard-ready exercises
    # (one per genuine learner task; never titles, track listings or markers).
    flashcards: list[FlashcardExercise] = Field(default_factory=list)

    # Extended output schema fields (per Woodpacker_Extraction_Service.md)
    course: dict = Field(default_factory=dict)
    chapters: list[str] = Field(default_factory=list)
    lessons: list[dict] = Field(default_factory=list)
    topics: list[dict] = Field(default_factory=list)
    grammar_rules: list[dict] = Field(default_factory=list)
    vocabulary: list[dict] = Field(default_factory=list)
    images: list[ExtractedImageModel] = Field(default_factory=list)
    audio: list[dict] = Field(default_factory=list)
    layout_blocks: list[LayoutBlockModel] = Field(default_factory=list)
    ocr_used: bool = False
    ocr_engine: str = "pymupdf"
