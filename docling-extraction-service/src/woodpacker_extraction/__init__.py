"""Woodpacker Learning Material Intelligence Agent."""

from .extract_pdf import extract_pdf_bytes, extract_pdf_from_path
from .pipeline import run_pipeline
from .graph import run_graph_extraction, ExtractionState
from .agent import build_graph, run_agent, classify_material
from .models import (
    LearningMaterialGraph,
    MaterialClassification,
    ExerciseRef,
    ExerciseItem,
    ResourceLink,
    KnowledgeGraph,
    QualityReport,
)
from .prompt import LMRE_PROMPT, OPENCODE_BASE_URL, get_opencode_client, get_chat_model
from .vision import describe_image, classify_exercise_type as vision_classify_exercise_type
from .extractor import classify_exercise_type, classify_exercise_type_heuristic
from .relationship_builder import (
    FileInput,
    ProcessedFile,
    RelationshipBuilder,
    build_relationships,
    detect_file_type,
)

# Optional: Prisma storage (requires `prisma generate` and DATABASE_URL)
try:
    from .storage import LessonMaterialStorage, store_relationships
except ImportError:
    LessonMaterialStorage = None  # type: ignore
    store_relationships = None  # type: ignore

__all__ = [
    "LMRE_PROMPT",
    "OPENCODE_BASE_URL",
    "get_opencode_client",
    "get_chat_model",
    "describe_image",
    "vision_classify_exercise_type",
    "classify_exercise_type",
    "classify_exercise_type_heuristic",
    "build_graph",
    "run_agent",
    "classify_material",
    "run_pipeline",
    "run_graph_extraction",
    "ExtractionState",
    "extract_pdf_bytes",
    "extract_pdf_from_path",
    "LearningMaterialGraph",
    "MaterialClassification",
    "ExerciseRef",
    "ExerciseItem",
    "ResourceLink",
    "KnowledgeGraph",
    "QualityReport",
    "FileInput",
    "ProcessedFile",
    "RelationshipBuilder",
    "build_relationships",
    "detect_file_type",
    "LessonMaterialStorage",
    "store_relationships",
]
