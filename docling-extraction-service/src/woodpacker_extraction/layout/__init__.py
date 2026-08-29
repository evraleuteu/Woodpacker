"""Deterministic layout-first document understanding pipeline.

This package implements the rebuilt Woodpacker PDF detection & extraction
system. Core principle: layout analysis detects document structure; LLMs only
enrich already-detected blocks.

Stages (each an independently testable function):

    PDF Loader          pdf_loader.load_pdf()
    Layout Detection    providers.detect_layout()   (DocAI > PP-Structure > Surya > PyMuPDF)
    Block Extraction    crops.crop_blocks()
    OCR                 ocr.run_block_ocr()         (per block, never per page)
    Classification      classify.classify_blocks()  (rules first, LLM tie-break)
    Relationships       relationships.build_relationships()
    Knowledge Graph     knowledge_graph.build_graph()
    Exercise Detection  exercises.detect_exercises()
    Storage             storage.store_bundle()

The LangGraph orchestration lives in :mod:`woodpacker_extraction.layout.graph`.
"""

from .types import (
    BBox,
    BLOCK_TYPES,
    EXERCISE_TYPES,
    AudioReference,
    BlockType,
    Classification,
    DocumentBundle,
    Exercise,
    ImageUnderstanding,
    LayoutBlock,
    OcrText,
    PageModel,
    Relationship,
)

__all__ = [
    "AudioReference",
    "BBox",
    "BLOCK_TYPES",
    "BlockType",
    "Classification",
    "DocumentBundle",
    "EXERCISE_TYPES",
    "Exercise",
    "ImageUnderstanding",
    "LayoutBlock",
    "OcrText",
    "PageModel",
    "Relationship",
]
