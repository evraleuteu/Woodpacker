"""The Learning Material Intelligence Agent.

Builds a :class:`~woodpacker_extraction.models.LearningMaterialGraph` from a
batch of files using the new 10-stage extraction pipeline (PyMuPDF layout
reconstruction, OCR, image extraction), and optionally refines the
material classification with the OpenCode LLM driven by ``LMRE_PROMPT``.
"""

from __future__ import annotations

import json as _json
import logging
import re
from pathlib import Path

from .extractor import FileEntry, detect_kind, extract_text, classify_file
from .extractor import detect_exercises
from .extractor import extract_exercise_items as split_items
from .extractor import detect_media_refs, match_media_number, chapter_number
from .models import (
    MaterialClassification,
    ExerciseRef,
    ExerciseItem,
    ResourceLink,
    KnowledgeNode,
    LearningMaterialGraph,
)
from .prompt import LMRE_PROMPT, get_chat_model, opencode_configured, OPENCODE_BASE_URL
from .pipeline import run_pipeline

logger = logging.getLogger(__name__)

__all__ = ["LMRE_PROMPT", "build_graph", "run_agent", "classify_material", "OPENCODE_BASE_URL", "run_pipeline"]


def classify_material(entry: FileEntry) -> tuple[str, float]:
    """Public classifier used by callers / the LLM override hook."""
    return classify_file(entry)


def _read_entry(path: str, file_id: str) -> FileEntry:
    name = Path(path).name
    text, page_count = extract_text(path)
    return FileEntry(
        file_id=file_id,
        name=name,
        path=path,
        kind=detect_kind(name),
        text=text,
        page_count=page_count,
        word_count=len(text.split()) if text else 0,
    )


def _refine_with_llm(entries, current):
    """Best-effort refinement of per-file classification using OpenCode + LMRE_PROMPT.

    Falls back to the heuristic graph if the LLM is unavailable. Never raises.
    """
    try:
        model = get_chat_model()
    except Exception:
        return current

    payload = [
        {
            "file_id": e.file_id,
            "file_name": e.name,
            "kind": e.kind,
            "page_count": e.page_count,
            "word_count": e.word_count,
            "excerpt": (e.text or "")[:1500],
        }
        for e in entries
    ]
    try:
        from langchain_core.messages import HumanMessage, SystemMessage

        resp = model.invoke([
            SystemMessage(content=LMRE_PROMPT),
            HumanMessage(content="Classify these files into a MaterialType with confidence 0-1. "
                f"Return ONLY JSON: {{\"classifications\":[{{\"file_id\":...,\"file_name\":...,\"file_type\":...,\"confidence\":0.0}}]}}.\n\nFiles: {_json.dumps(payload)}"),
        ])
        raw = resp.content or ""
        data = _json.loads(raw)
        refined = {c["file_id"]: c for c in data.get("classifications", []) if isinstance(c, dict) and "file_type" in c}
    except Exception:
        return current

    out = list(current)
    for i, c in enumerate(out):
        r = refined.get(c["file_id"])
        if r:
            out[i] = {**c, "file_type": r["file_type"], "confidence": r.get("confidence", c["confidence"])}
    return out


def build_graph(paths, refine: bool = True) -> LearningMaterialGraph:
    """Build the structured relationship graph for the given file paths.

    Uses the new 10-stage pipeline with PyMuPDF for layout reconstruction
    and image extraction. Optionally refines document classification with
    the OpenCode LLM via ``LMRE_PROMPT``.

    Args:
        paths: iterable of file paths.
        refine: if True and an OpenCode API key is configured, refine
            classifications with the LLM (Role prompt). Otherwise pure heuristic.
    """
    entries = [_read_entry(p, f"file-{i}") for i, p in enumerate(paths)]

    # Run full 10-stage pipeline for each file
    pipeline_results = []
    for i, path in enumerate(paths):
        file_id = f"file-{i}"
        result = run_pipeline(path, file_id, all_entries=None)
        pipeline_results.append(result)

    # Merge pipeline results into the graph shape
    classifications, exercises, items, links, nodes = _build_graph_from_pipeline(pipeline_results)
    flashcards = [
        {
            "id": f.get("id"),
            "type": f.get("type"),
            "prompt": f.get("prompt", ""),
            "answer": f.get("answer"),
            "options": f.get("options") or [],
            "page": f.get("page"),
            "name": f.get("name"),
            "source": f.get("source") or r.get("file_id", ""),
            "page_number": f.get("page_number"),
            "required_audio": f.get("required_audio") or [],
            "required_video": f.get("required_video") or [],
            "solutions": f.get("solutions") or [],
        }
        for r in pipeline_results
        for f in r.get("flashcards", [])
    ]

    if refine and opencode_configured() and entries:
        classifications = _refine_with_llm(entries, classifications)

    quality = _compute_quality(pipeline_results)

    return LearningMaterialGraph(
        classifications=classifications,
        exercises=exercises,
        items=items,
        resourceLinks=links,
        knowledgeGraph={"nodes": nodes, "links": []},
        quality=quality,
        flashcards=flashcards,
        course={},
        chapters=[],
        lessons=[],
        topics=[],
        grammar_rules=[],
        vocabulary=[],
        images=[],
        audio=[],
        layout_blocks=[b for r in pipeline_results for b in r.get("layout_blocks", [])],
        ocr_used=any(r.get("ocr_used") for r in pipeline_results),
        ocr_engine=next((r.get("ocr_engine", "pymupdf") for r in pipeline_results if r.get("ocr_used")), "pymupdf"),
    )


def run_agent(paths, refine: bool = True) -> dict:
    """Run the engine and return a JSON-serializable dict."""
    graph = build_graph(paths, refine=refine)
    return graph.model_dump(by_alias=True, exclude_none=True)


# ---- graph builders ----


def _build_graph_from_pipeline(results: list[dict]) -> tuple[list[dict], list[ExerciseRef], list[ExerciseItemModel], list[ResourceLink], list[dict]]:
    """Convert pipeline output dicts into the LearningMaterialGraph shape."""
    classifications = [c for r in results for c in r.get("classifications", [])]
    exercises: list[ExerciseRef] = []
    items: list[ExerciseItemModel] = []
    links: list[ResourceLink] = []
    nodes: list[dict] = []

    for r in results:
        fid = r.get("file_id", "")
        nodes.append({"id": fid, "type": "chapter", "label": r.get("file_name", "")})

        for ex in r.get("exercises", []):
            exercises.append(ExerciseRef(
                exercise_id=ex["exercise_id"],
                chapter=ex.get("chapter", ""),
                section=ex.get("section", ""),
                exercise_title=ex.get("exercise_title", ""),
                exercise_type="open_ended",  # type: ignore[arg-type]
                page=ex.get("page", 0),
            ))
            nodes.append({"id": ex["exercise_id"], "type": "exercise", "label": ex.get("exercise_title", "")[:80]})

        for item in r.get("questions", []):
            items.append(ExerciseItem(
                exercise_item_id=item["exercise_item_id"],
                exercise_id=item["exercise_id"],
                question=item["question"],
                answer=item.get("answer"),
                position=item.get("position", 1),
                page=item.get("page"),
                linked_images=item.get("linked_images", []),
                linked_audio=item.get("linked_audio", []),
            ))
            nodes.append({"id": item["exercise_item_id"], "type": "question", "label": item["question"][:80]})

        # Resource links from media refs
        for ref in r.get("audio", []):
            links.append(ResourceLink(
                relationship="exercise_to_audio",
                from_=ref["exercise_id"],
                to=f"track_{ref['media_type']}",
                confidence=0.9,
                rationale=f"Media reference matched: {ref['numbers']}",
            ))

    return classifications, exercises, items, links, nodes


def _compute_quality(results: list[dict]) -> dict:
    """Compute aggregate quality report across all files."""
    total_exercises = sum(len(r.get("exercises", [])) for r in results)
    orphan_audio = 0
    missing_solutions = 0
    duplicate_exercises = 0
    issues: list[str] = []

    for r in results:
        if r.get("is_scanned") and not r.get("ocr_used"):
            issues.append(f"{r.get('file_name', 'unknown')}: scanned PDF without OCR text")

    quality = {
        "exercises_extracted": total_exercises,
        "orphan_audio": orphan_audio,
        "orphan_video": 0,
        "duplicate_exercises": duplicate_exercises,
        "missing_solutions": missing_solutions,
        "issues": issues,
    }
    return quality
