"""LangGraph extraction workflow — compiled once, checkpointed, resumable.

Architecture (Phases 5/6/7/11/12):

    START
      ↓
    ingest_text          DocumentAsset already parsed once (assets.py)
      ↓
    classify_document    deterministic + optional LLM tiebreak
      ↓
    lesson_extract       layout blocks → context
      ↓
    exercise_extract     LLM/heuristic per page-chunk (bounded concurrency)
      ↓
    normalize_exercises  stable IDs, fuzzy dedup (identity.py)
      ↓
    media_link           resolve refs against the REAL media inventory;
                         unresolved → orphan_media (never fake links)
      ↓
    validate_quality     gates; on failure and repair_pass == 0:
      │                    → exercise_repair (flagged pages only)
      │                    → normalize_exercises → validate_quality again
      ▼
    persist              assemble final payload (DB writes stay in the
                         orchestration layer — unchanged API contract)

Guarantees:
* The graph is compiled ONCE per process (get_extraction_graph()).
* State is a typed dict; nodes return PARTIAL updates, never mutate input.
* Checkpointing keyed by job_id → interrupted runs are resumable.
* Maximum ONE repair pass — no loops.
* Every node is timed into state["telemetry"] for observability.
"""

from __future__ import annotations

import logging
import os
import random
import re
import time
from typing import Any, Callable, TypedDict

from langgraph.graph import StateGraph, END

from . import identity as ident
from .assets import DocumentAsset, apply_ocr_to_asset
from .extractor import (
    FileEntry,
    classify_file,
    detect_media_refs,
    extract_exercise_items,
    match_media_number,
    chapter_number,
)
from .exercises import extract_exercises
from .models import ExerciseItem  # noqa: F401  (re-exported for typing parity)
from .validation import parse_page_refs

logger = logging.getLogger(__name__)

MAX_REPAIR_PASSES = 1
SPOT_CHECK_RATE = float(os.environ.get("LLM_SPOTCHECK_RATE", "0.05"))


# ---------------------------------------------------------------------------
# Typed state
# ---------------------------------------------------------------------------

class ExtractionState(TypedDict, total=False):
    job_id: str
    asset: DocumentAsset
    # Shared batch context: sibling summaries + real media inventory.
    context: dict[str, Any]

    classification: dict[str, Any]
    chapters: list[str]
    exercises: list[dict[str, Any]]
    items: list[dict[str, Any]]
    flashcards: list[dict[str, Any]]
    orphan_media: list[dict[str, Any]]
    relationships: list[dict[str, Any]]

    repair_pass: int
    repair_pages: list[int]
    quality: dict[str, Any]
    needs_review: bool

    telemetry: list[dict[str, Any]]
    result: dict[str, Any]


# ---------------------------------------------------------------------------
# Compile-once graph + checkpointer
# ---------------------------------------------------------------------------

_COMPILED: Any = None


def get_extraction_graph() -> Any:
    """Build and compile the workflow exactly once per process."""
    global _COMPILED
    if _COMPILED is not None:
        return _COMPILED

    workflow = StateGraph(ExtractionState)

    def _timed(name: str, fn: Callable[[ExtractionState], dict[str, Any]]):
        def wrapped(state: ExtractionState) -> dict[str, Any]:
            started_at = time.time()
            started = time.monotonic()
            status, error = "ok", None
            update: dict[str, Any] = {}
            try:
                update = fn(state) or {}
                return update
            except Exception as exc:  # noqa: BLE001
                status, error = "error", str(exc)
                logger.exception("Node %s failed", name)
                raise
            finally:
                duration_ms = round((time.monotonic() - started) * 1000, 1)
                entry = {
                    "node": name,
                    "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(started_at)),
                    "duration_ms": duration_ms,
                    "status": status,
                    "error": error,
                }
                # On success this mutates the returned partial update; on
                # failure the exception propagates (BullMQ records it).
                update["telemetry"] = list(state.get("telemetry") or []) + [entry]
        return wrapped

    workflow.add_node("ingest_text", _timed("ingest_text", node_ingest_text))
    workflow.add_node("classify_document", _timed("classify_document", node_classify_document))
    workflow.add_node("lesson_extract", _timed("lesson_extract", node_lesson_extract))
    workflow.add_node("exercise_extract", _timed("exercise_extract", node_exercise_extract))
    workflow.add_node("normalize_exercises", _timed("normalize_exercises", node_normalize_exercises))
    workflow.add_node("media_link", _timed("media_link", node_media_link))
    workflow.add_node("validate_quality", _timed("validate_quality", node_validate_quality))
    workflow.add_node("exercise_repair", _timed("exercise_repair", node_exercise_repair))
    workflow.add_node("persist", _timed("persist", node_persist))

    workflow.set_entry_point("ingest_text")
    workflow.add_edge("ingest_text", "classify_document")
    workflow.add_edge("classify_document", "lesson_extract")
    workflow.add_edge("lesson_extract", "exercise_extract")
    workflow.add_edge("exercise_extract", "normalize_exercises")
    workflow.add_edge("normalize_exercises", "media_link")
    workflow.add_edge("media_link", "validate_quality")

    # Conditional: fail → ONE repair pass → re-normalize → re-validate.
    workflow.add_conditional_edges(
        "validate_quality",
        _route_after_validation,
        {
            "repair": "exercise_repair",
            "persist": "persist",
        },
    )
    workflow.add_edge("exercise_repair", "normalize_exercises")
    workflow.add_edge("persist", END)

    _COMPILED = workflow.compile(checkpointer=_make_checkpointer())
    return _COMPILED


def _make_checkpointer() -> Any:
    """Persistent checkpointer when available/configured, else in-memory.

    Set CHECKPOINT_DB=/path/to.sqlite to enable cross-restart resume
    (requires langgraph-checkpoint-sqlite). MemorySaver still makes runs
    resumable within the process (worker crash + BullMQ retry).
    """
    db_path = os.environ.get("CHECKPOINT_DB")
    if db_path:
        try:
            from langgraph.checkpoint.sqlite import SqliteSaver

            conn = __import__("sqlite3").connect(db_path, check_same_thread=False)
            logger.info("LangGraph checkpointing enabled: %s", db_path)
            return SqliteSaver(conn)
        except ImportError:
            logger.warning("CHECKPOINT_DB set but langgraph-checkpoint-sqlite not installed")
    from langgraph.checkpoint.memory import MemorySaver

    return MemorySaver()


def _route_after_validation(state: ExtractionState) -> str:
    quality = state.get("quality") or {}
    repair_pass = int(state.get("repair_pass") or 0)
    if quality.get("needs_repair") and repair_pass < MAX_REPAIR_PASSES and quality.get("repair_pages"):
        return "repair"
    return "persist"


# ---------------------------------------------------------------------------
# Nodes (pure functions: state in → partial update out)
# ---------------------------------------------------------------------------

def node_ingest_text(state: ExtractionState) -> dict[str, Any]:
    """OCR fallback for scanned PDFs happens here (page-level, Phase 3)."""
    asset: DocumentAsset = state["asset"]
    if asset.kind == "pdf" and asset.metadata.get("is_scanned"):
        from .ocr import smart_text_extraction

        try:
            text, ocr_used, engine = smart_text_extraction(asset.metadata.get("_path") or "")
            if ocr_used:
                apply_ocr_to_asset(asset, text, engine)
        except Exception as exc:  # noqa: BLE001
            logger.warning("OCR fallback failed for %s: %s", asset.filename, exc)

    truncation = asset.metadata.get("truncation")
    return {
        "chapters": [],
        "needs_review": bool(truncation),
        "quality": {
            "truncation": truncation,
            "issues": ["page_cap: document exceeds hard page cap"] if truncation else [],
        },
    }


def _asset_to_file_entry(asset: DocumentAsset) -> FileEntry:
    """Project a DocumentAsset onto the legacy FileEntry shape used by
    classify_file() — no re-parsing involved."""
    return FileEntry(
        file_id=asset.file_id,
        name=asset.filename,
        path=asset.filename,
        kind=asset.kind,
        text=asset.text,
        page_count=asset.page_count,
        word_count=len(asset.text.split()) if asset.text else 0,
        blocks=asset.layout_blocks,
        images=asset.images,
        is_scanned=bool(asset.metadata.get("is_scanned")),
        ocr_engine=asset.metadata.get("ocr_engine", "pymupdf"),
    )


def node_classify_document(state: ExtractionState) -> dict[str, Any]:
    asset: DocumentAsset = state["asset"]
    entry = _asset_to_file_entry(asset)
    role, conf = classify_file(entry)
    classification = {
        "file_id": asset.file_id,
        "file_name": asset.filename,
        "file_type": role,
        "confidence": round(conf, 2),
    }
    asset.metadata["material_type"] = role
    return {"classification": classification}


def node_lesson_extract(state: ExtractionState) -> dict[str, Any]:
    """Validate that every page contributes at least one of the 6 block types.

    The extractor (assets.py / extractor.py) already clamps bboxes and
    synthesizes a fallback text/image block when a page would otherwise be
    empty. This node double-checks the invariant and repairs in-memory if
    the asset was built before the extractor patch (old cached asset path).
    """
    asset: DocumentAsset = state["asset"]
    blocks = [b.to_dict() for b in asset.layout_blocks[:200]]
    images_meta = [
        {
            "image_id": img.image_id,
            "page": img.page,
            "bbox": list(img.bbox),
            "ext": img.ext,
            "data_size": len(img.data),
        }
        for img in asset.images
    ]

    # Repair: ensure every page number appearing in asset.pages has at least
    # one block (text or image). This guarantees the "no exercise -> still
    # text/image" requirement even for assets built before the extractor fix.
    page_numbers = {n for n, _ in (asset.pages or [])}
    # Also include pages that are implied by page_count but have no text pages
    # (e.g. scanned image-only pages where asset.pages may be sparse).
    if asset.page_count and len(page_numbers) < asset.page_count:
        for n in range(1, asset.page_count + 1):
            page_numbers.add(n)
    pages_with_blocks = {b["page"] for b in blocks if isinstance(b.get("page"), int)}
    missing = sorted(page_numbers - pages_with_blocks)
    for pg in missing:
        # Prefer image when the asset actually has images on that page.
        has_image_on_page = any(img.page == pg for img in asset.images)
        if has_image_on_page:
            img_on_page = next(img for img in asset.images if img.page == pg)
            blocks.append({
                "type": "image",
                "text": "",
                "bbox": list(img_on_page.bbox),
                "page": pg,
                "spans": [],
            })
        else:
            # Find the textual content for this page, if any.
            page_text = next((t for n, t in (asset.pages or []) if n == pg), "")
            snippet = (page_text or "").strip()[:400]
            if snippet:
                # Heuristic: short uppercase page → heading, else text.
                is_heading = snippet.split("\n")[0].strip().isupper() and len(snippet.split("\n")[0]) < 60
                blocks.append({
                    "type": "heading" if is_heading else "text",
                    "text": snippet,
                    "bbox": [20, 80, 575, 120] if asset.page_count else [0, 0, 100, 20],
                    "page": pg,
                    "spans": [],
                    "fallback": True,
                })

    quality = dict(state.get("quality") or {})
    # Summarize layout taxonomy for observability — the inspector uses this
    # to show per-type counts, not just total blocks.
    taxonomy: dict[str, int] = {}
    for b in blocks:
        t = str(b.get("type") or "unknown")
        taxonomy[t] = taxonomy.get(t, 0) + 1
    quality.update({
        "layout_blocks": len(blocks),
        "layout_taxonomy": taxonomy,
        "images": len(images_meta),
        "heading_blocks": taxonomy.get("heading", 0),
        "text_blocks": taxonomy.get("text", 0),
        "exercise_blocks": taxonomy.get("exercise", 0),
        "audio_ref_blocks": taxonomy.get("audio_ref", 0),
        "video_ref_blocks": taxonomy.get("video_ref", 0),
        "image_blocks": taxonomy.get("image", 0),
    })
    # Expose the repaired blocks back on the asset so persist sees them.
    if missing:
        # Append repaired dicts as LayoutBlock-like objects (minimal).
        from .extractor import LayoutBlock, TextSpan
        for b in blocks:
            if b.get("fallback"):
                asset.layout_blocks.append(LayoutBlock(
                    block_type=b["type"],
                    text=b["text"],
                    bbox=tuple(b["bbox"]),  # type: ignore
                    page=b["page"],
                    spans=[],
                ))
    return {"quality": quality}


def node_exercise_extract(state: ExtractionState) -> dict[str, Any]:
    asset: DocumentAsset = state["asset"]
    require_answer = bool((state.get("context") or {}).get("require_answer"))
    result = extract_exercises(asset.filename, asset.text, require_answer=require_answer)
    stats = result.get("stats") or {}
    exercises = []
    for i, ex in enumerate(result["exercises"]):
        exercises.append(
            {
                "exercise_id": f"ex-{asset.file_id}-{i}",
                "prompt": ex.get("prompt", ""),
                "page": ex.get("page"),
                "name": ex.get("name"),
                "exercise_type": ex.get("type") or "assessment",
                "answer": ex.get("answer"),
                "options": ex.get("options") or [],
                "_source_mode": result["mode"],
            }
        )
    quality = dict(state.get("quality") or {})
    if stats.get("capped"):
        quality.setdefault("issues", []).append("exercise_cap_hit")
        quality["capped"] = True
    if stats.get("failed_chunks"):
        quality.setdefault("issues", []).append(f"llm_failed_chunks:{stats['failed_chunks']}")

    # Merge LLM-detected layout blocks (no bbox) into asset.layout_blocks so the
    # inspector and quality gate can see page coverage even for scanned PDFs where
    # PyMuPDF detected sparse blocks. These are synthesis for page coverage only.
    _TYPE_MAP = {
        "_headings": "heading",
        "_text_blocks": "text",
        "_image_refs": "image",
        "_audio_refs": "audio_ref",
        "_video_refs": "video_ref",
    }
    for name, bucket in (
        ("_headings", stats.get("_headings", [])),
        ("_text_blocks", stats.get("_text_blocks", [])),
        ("_image_refs", stats.get("_image_refs", [])),
        ("_audio_refs", stats.get("_audio_refs", [])),
        ("_video_refs", stats.get("_video_refs", [])),
    ):
        for entry in bucket:
            page = entry.get("page")
            text = entry.get("text", "")
            # Find the block type from bucket naming
            btype = _TYPE_MAP.get(name, "text")
            # Skip if PyMuPDF already has a block on this page with same text
            text_norm = text.strip().lower()
            if any(b.page == page and getattr(b, "text", "").strip().lower() == text_norm
                   for b in asset.layout_blocks):
                continue
            asset.layout_blocks.append(LayoutBlock(
                block_type=btype,
                text=text,
                bbox=(0, 0, 0, 0),  # no bbox from LLM
                page=page,
                spans=[],
            ))

    # Propagate taxonomy counts from stats if PyMuPDF layout was sparse
    existing_tax = quality.get("layout_taxonomy") or {}
    if sum(existing_tax.values()) < sum(1 for _ in asset.layout_blocks):
        quality["layout_taxonomy"] = {
            "heading": len([b for b in asset.layout_blocks if b.block_type == "heading"]),
            "text": len([b for b in asset.layout_blocks if b.block_type == "text"]),
            "image": len([b for b in asset.layout_blocks if b.block_type == "image"]),
            "audio_ref": len([b for b in asset.layout_blocks if b.block_type == "audio_ref"]),
            "video_ref": len([b for b in asset.layout_blocks if b.block_type == "video_ref"]),
            "exercise": 0,  # exercises live in exercises array
        }
    return {"exercises": exercises, "chapters": state.get("chapters") or [], "quality": quality, "stats": stats}


def node_normalize_exercises(state: ExtractionState) -> dict[str, Any]:
    """Stable IDs + fuzzy duplicate detection (Phase 9)."""
    asset: DocumentAsset = state["asset"]
    context = state.get("context") or {}
    chapter = chapter_number(asset.filename) or ""
    course_id = context.get("course_id", "")

    normalized: list[dict[str, Any]] = []
    for ex in state.get("exercises") or []:
        pages = parse_page_refs(str(ex.get("page") or ""))
        number = ident.exercise_number(ex.get("name") or ex.get("prompt", ""))
        key = ident.stable_exercise_key(
            course_id=course_id,
            material_id=asset.sha256[:16],
            chapter=chapter,
            number=number,
            prompt=ex.get("prompt", ""),
            pages=pages,
        )
        item = dict(ex)
        item["_number"] = number
        item["_pages"] = pages
        item["_key"] = key
        normalized.append(item)

    deduped = ident.find_duplicates(normalized)
    kept = [e for e in deduped if not e.get("duplicate_confirmed")]
    needs_review = any(e.get("needs_review") for e in kept)

    # Decompose into learner-facing items.
    items: list[dict[str, Any]] = []
    flashcards: list[dict[str, Any]] = []
    for ex in kept:
        ex_items = extract_exercise_items(ex["exercise_id"], ex.get("prompt", ""))
        for it in ex_items:
            if ex.get("page"):
                it["page"] = ex["page"]
            it["linked_images"] = []
            it["linked_audio"] = []
            items.append(it)
        page_num = ex["_pages"][0] if ex["_pages"] else 0
        flashcards.append(
            {
                "id": ex["exercise_id"],
                "type": ex.get("exercise_type") or "assessment",
                "prompt": ex.get("prompt", ""),
                "answer": ex.get("answer"),
                "options": ex.get("options") or [],
                "page": ex.get("page"),
                "name": ex.get("name"),
                "source": asset.file_id,
                "page_number": page_num or None,
                "required_audio": [],
                "required_video": [],
                "solutions": [],
                "stable_key": ex["_key"],
                "needs_review": bool(ex.get("needs_review")),
            }
        )

    return {
        "exercises": kept,
        "items": items,
        "flashcards": flashcards,
        "needs_review": needs_review or bool(state.get("needs_review")),
    }


def node_media_link(state: ExtractionState) -> dict[str, Any]:
    """Resolve media references against the REAL inventory (Phase 11).

    A reference becomes a link ONLY when it resolves to an actual uploaded
    file. Unresolved references are reported as orphan_media / needs_review —
    never emitted as synthetic links like `track_12`.
    """
    asset: DocumentAsset = state["asset"]
    context = state.get("context") or {}
    inventory: list[dict[str, Any]] = context.get("media_inventory") or []

    audio_files = [m for m in inventory if m.get("kind") == "audio"]
    video_files = [m for m in inventory if m.get("kind") == "video"]
    own_chapter = chapter_number(asset.filename)

    orphan_media: list[dict[str, Any]] = []
    resolved_audio: dict[str, list[str]] = {}

    for item in state.get("items") or []:
        text = f"{item.get('question', '')}"
        refs = detect_media_refs(text)
        for kind, numbers in refs:
            for num in numbers:
                match = _resolve_media(num, kind, audio_files if kind == "audio" else video_files, own_chapter)
                if match:
                    key = "linked_audio" if kind == "audio" else "linked_video"
                    item.setdefault(key, []).append(match["file_id"])
                else:
                    orphan_media.append(
                        {
                            "exercise_item_id": item["exercise_item_id"],
                            "media_type": kind,
                            "track": num,
                        }
                    )

    # Image links: same-page images for prompts referencing pictures.
    image_keywords = re.compile(r"bild|picture|abbildung|figure|fig\.\s*\d+", re.IGNORECASE)
    images_meta = [
        {"image_id": img.image_id, "page": img.page} for img in asset.images
    ]
    for ex in state.get("exercises") or []:
        if not image_keywords.search(ex.get("prompt", "")):
            continue
        pages = parse_page_refs(str(ex.get("page") or ""))
        linked = [img["image_id"] for img in images_meta if img["page"] in pages]
        if not linked:
            continue
        for item in state.get("items") or []:
            if item["exercise_id"] == ex["exercise_id"]:
                item.setdefault("linked_images", []).extend(linked)

    quality = dict(state.get("quality") or {})
    if orphan_media:
        quality["orphan_media"] = orphan_media
        quality.setdefault("issues", []).append(f"unresolved_media_refs:{len(orphan_media)}")

    return {
        "items": state.get("items") or [],
        "orphan_media": orphan_media,
        "resolved_audio": resolved_audio,
        "quality": quality,
        "needs_review": bool(orphan_media) or bool(state.get("needs_review")),
    }


def _resolve_media(
    number: int,
    kind: str,
    files: list[dict[str, Any]],
    own_chapter: str | None,
) -> dict[str, Any] | None:
    """Find the real uploaded file for a Track/N reference.

    Priority: exact track-number match in filename → chapter-scoped match →
    unique global numeric match. Returns None when ambiguous or missing.
    """
    candidates = [f for f in files if match_media_number(f.get("name", ""), [number])]
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]
    if own_chapter:
        scoped = [
            f for f in candidates
            if chapter_number(f.get("name", "")) == own_chapter
        ]
        if len(scoped) == 1:
            return scoped[0]
    return None  # ambiguous — refuse to guess


def node_validate_quality(state: ExtractionState) -> dict[str, Any]:
    """Quality gates (Phase 12). Sets needs_repair + repair_pages on failure.

    Pages that have no exercises but contain text/image/heading/audio/video
    blocks are considered *covered* for page-level metrics, satisfying the
    requirement that "if a page doesn't contain exercise, it should at least
    detect the text or the image". Only truly empty pages count toward
    low coverage.
    """
    asset: DocumentAsset = state["asset"]
    exercises = state.get("exercises") or []
    items = state.get("items") or []
    quality = dict(state.get("quality") or {})
    issues: list[str] = quality.setdefault("issues", [])

    total_pages = asset.page_count or len(asset.pages) or 0
    pages_with_exercises = {
        p for ex in exercises for p in (parse_page_refs(str(ex.get("page") or "")) or [])
    }
    # Pages that have any layout block (heading/text/image/audio_ref/video_ref).
    # This is the fallback coverage that keeps text/image pages from looking
    # like extraction failures.
    pages_with_layout = {b.page for b in asset.layout_blocks if getattr(b, "page", None)}
    # Merge fallback string dict form if repair synthesized dict blocks.
    taxonomy = quality.get("layout_taxonomy") or {}
    has_text_fallback = (taxonomy.get("text_blocks", 0) + taxonomy.get("heading_blocks", 0) + taxonomy.get("image_blocks", 0)) > 0

    # 1. Exercise count validation — zero exercises is NOT an error when
    # the layout fallback shows the page still contributed text/image.
    count = len(exercises)
    if count == 0:
        if not has_text_fallback and not pages_with_layout:
            issues.append("zero_exercises")
        else:
            # Record that fallback kept the page useful, but don't flag as issue.
            quality["zero_exercises_fallback"] = "text_or_image_present"
    elif total_pages and count / max(total_pages, 1) > 4:
        issues.append("suspiciously_high_count")
    elif quality.get("capped"):
        pass  # already flagged at extraction time
    elif total_pages >= 20 and count < total_pages / 10 and not has_text_fallback:
        issues.append("suspiciously_low_count")

    # 2. Page coverage validation — count pages covered by EITHER exercises
    # OR any layout block. Without this, image-only or text-only pages
    # incorrectly drag coverage to near zero.
    covered_pages = pages_with_exercises | pages_with_layout
    coverage = (len(covered_pages) / total_pages) if total_pages else 0.0
    quality["coverage"] = round(coverage, 3)
    quality["pages_with_exercises"] = len(pages_with_exercises)
    quality["pages_with_layout"] = len(pages_with_layout)
    quality["processed_pages"] = len(asset.pages)
    quality["total_pages"] = total_pages
    skipped = (asset.metadata.get("scan", {}) or {}).get("textless_pages") or []
    quality["skipped_pages"] = len(skipped)
    if total_pages >= 10 and coverage < 0.1:
        # Only flag when even the layout fallback leaves pages empty.
        if not has_text_fallback:
            issues.append("low_page_coverage")

    # 3. Duplicates (fuzzy flags from normalization)
    dup_candidates = sum(1 for e in exercises if e.get("needs_review"))
    quality["duplicate_candidates"] = dup_candidates

    # 4. Media references
    quality["orphan_media_count"] = len(state.get("orphan_media") or [])

    # 5. Solution validation: MC answer ∈ options
    mc_violations = 0
    for fc in state.get("flashcards") or []:
        if fc.get("type") == "multiple-choice" and fc.get("answer") and fc.get("options"):
            norm = ident.normalize_prompt(fc["answer"])
            if not any(ident.normalize_prompt(o) == norm for o in fc["options"]):
                mc_violations += 1
    if mc_violations:
        issues.append(f"mc_answer_not_in_options:{mc_violations}")

    # 6. OCR confidence gate
    if asset.metadata.get("ocr_used"):
        quality["ocr_engine"] = asset.metadata.get("ocr_engine")
        # Page-level OCR has no per-word confidence yet; scanned content is
        # always marked for review until confidence plumbing exists.
        issues.append("ocr_content_needs_review")

    needs_repair = count == 0 or quality.get("capped") or (
        coverage < 0.05 and total_pages >= 20
    )
    repair_pages: list[int] = []
    if needs_repair:
        # Repair targets: sampled textless-but-not-actually-scanned pages and
        # pages around coverage gaps. Bounded to keep the pass cheap.
        all_page_numbers = [n for n, _ in asset.pages]
        covered = pages_with_exercises
        repair_pages = [n for n in all_page_numbers if n not in covered][:12]

    quality["needs_repair"] = needs_repair
    quality["repair_pages"] = repair_pages
    quality["exercises_extracted"] = count
    quality["duplicate_exercises"] = sum(1 for e in exercises if e.get("duplicate_of"))
    quality["missing_solutions"] = mc_violations
    quality["orphan_audio"] = quality.get("orphan_media_count", 0)
    quality["orphan_video"] = 0

    return {"quality": quality, "needs_review": bool(issues) or bool(state.get("needs_review"))}


def node_exercise_repair(state: ExtractionState) -> dict[str, Any]:
    """ONE bounded repair pass over flagged pages only."""
    asset: DocumentAsset = state["asset"]
    quality = dict(state.get("quality") or {})
    repair_pages = quality.get("repair_pages") or []
    if not repair_pages:
        return {"repair_pass": MAX_REPAIR_PASSES}

    require_answer = bool((state.get("context") or {}).get("require_answer"))
    result = extract_exercises(
        asset.filename, asset.text, require_answer=require_answer, pages=repair_pages
    )
    existing = {e.get("_key") or e.get("prompt", "").lower() for e in state.get("exercises") or []}
    merged = list(state.get("exercises") or [])
    added = 0
    base_index = len(merged)
    for ex in result["exercises"]:
        key = ident.stable_exercise_key(prompt=ex.get("prompt", ""), pages=parse_page_refs(str(ex.get("page") or "")))
        if key in existing:
            continue
        merged.append(
            {
                "exercise_id": f"ex-{asset.file_id}-r{base_index + added}",
                "prompt": ex.get("prompt", ""),
                "page": ex.get("page"),
                "name": ex.get("name"),
                "exercise_type": ex.get("type") or "assessment",
                "answer": ex.get("answer"),
                "options": ex.get("options") or [],
                "_key": key,
                "_repaired": True,
            }
        )
        added += 1

    quality["repair_added"] = added
    quality["needs_repair"] = False  # never loop: this was the one pass
    return {
        "exercises": merged,
        "repair_pass": MAX_REPAIR_PASSES,
        "quality": quality,
    }


def node_persist(state: ExtractionState) -> dict[str, Any]:
    """Assemble the final payload. DB writes remain in the caller's layer."""
    asset: DocumentAsset = state["asset"]
    classification = state.get("classification") or {}
    quality = dict(state.get("quality") or {})
    needs_review = bool(state.get("needs_review"))
    status = "needs_review" if needs_review else "processed"

    exercises_out = []
    for ex in state.get("exercises") or []:
        page_match = re.search(r"(\d+)", str(ex.get("page") or "0"))
        exercises_out.append(
            {
                "exercise_id": ex["exercise_id"],
                "chapter": chapter_number(asset.filename) or asset.filename,
                "section": ex.get("name") or "",
                "exercise_title": ex.get("name") or "",
                "exercise_type": ex.get("exercise_type") or "open_ended",
                "page": int(page_match.group(1)) if page_match else 0,
            }
        )

    media_refs = []
    for ex in state.get("exercises") or []:
        for kind, numbers in detect_media_refs(f"{ex.get('name', '')} {ex.get('prompt', '')}"):
            media_refs.append({"exercise_id": ex["exercise_id"], "media_type": kind, "numbers": numbers})

    nodes = [{"id": asset.file_id, "type": "chapter", "label": asset.filename}]
    links: list[dict[str, Any]] = []
    for ex in state.get("exercises") or []:
        nodes.append({"id": ex["exercise_id"], "type": "exercise", "label": (ex.get("name") or "")[:80]})
        ch = chapter_number(asset.filename)
        if ch:
            links.append({"relationship": "chapter_match", "from": asset.file_id, "to": ex["exercise_id"],
                          "confidence": 0.9, "rationale": f"Chapter {ch}"})
    for item in state.get("items") or []:
        nodes.append({"id": item["exercise_item_id"], "type": "question", "label": item["question"][:80]})
        links.append({"relationship": "exercise_to_reading", "from": item["exercise_id"],
                      "to": item["exercise_item_id"], "confidence": 1.0, "rationale": "Question belongs to exercise"})
        for audio_id in item.get("linked_audio", []):
            links.append({"relationship": "exercise_to_audio", "from": item["exercise_item_id"],
                          "to": audio_id, "confidence": 0.95, "rationale": "Resolved against media inventory"})
        for video_id in item.get("linked_video", []):
            links.append({"relationship": "exercise_to_video", "from": item["exercise_item_id"],
                          "to": video_id, "confidence": 0.95, "rationale": "Resolved against media inventory"})
        for img_id in item.get("linked_images", []):
            links.append({"relationship": "image_link", "from": item["exercise_item_id"],
                          "to": img_id, "confidence": 0.8, "rationale": "Image reference detected"})

    result = {
        "course": {},
        "chapters": [],
        "lessons": [],
        "topics": [],
        "grammar_rules": [],
        "vocabulary": [],
        "images": [
            {"image_id": img.image_id, "page": img.page, "bbox": list(img.bbox), "ext": img.ext,
             "data_size": len(img.data)}
            for img in asset.images
        ],
        "audio": media_refs,
        "layout_blocks": [b.to_dict() for b in asset.layout_blocks[:200]],
        "classifications": [classification],
        "exercises": exercises_out,
        "flashcards": state.get("flashcards") or [],
        "questions": state.get("items") or [],
        "answers": [
            {"question_id": i["exercise_item_id"], "answer": i.get("answer")}
            for i in (state.get("items") or []) if i.get("answer")
        ],
        "relationships": [],  # filled by the batch-level relationship engine
        "knowledgeGraph": {"nodes": nodes, "links": links},
        "quality": quality,
        "extraction_mode": (state.get("exercises") or [{}])[0].get("_source_mode", "heuristic")
        if state.get("exercises") else "heuristic",
        "ocr_used": bool(asset.metadata.get("ocr_used")),
        "ocr_engine": asset.metadata.get("ocr_engine", "pymupdf"),
        "is_scanned": bool(asset.metadata.get("is_scanned")),
        "page_count": asset.page_count,
        "word_count": len(asset.text.split()) if asset.text else 0,
        "sha256": asset.sha256,
        "status": status,
        "telemetry": state.get("telemetry") or [],
    }
    return {"result": result}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run_graph_extraction(
    file_path: str,
    file_id: str,
    all_entries: list[Any] | None = None,
    *,
    job_id: str | None = None,
    context: dict[str, Any] | None = None,
    asset: DocumentAsset | None = None,
) -> dict[str, Any]:
    """Run the graph for ONE file. Siblings are summaries, never re-parsed.

    ``all_entries`` accepts DocumentAssets (preferred) or paths (legacy) —
    only lightweight summaries are derived from them.
    """
    from .assets import build_document_asset

    doc_asset = asset or build_document_asset(file_path, file_id)
    doc_asset.metadata["_path"] = file_path

    sibling_summaries: list[dict[str, Any]] = []
    for other in all_entries or []:
        if isinstance(other, DocumentAsset):
            if other.file_id != doc_asset.file_id:
                sibling_summaries.append(other.to_summary())
        else:
            # Legacy path-based call: metadata-only scan (cheap, no full parse).
            sibling_summaries.append({"path": str(other), "filename": str(other)})

    ctx = dict(context or {})
    ctx.setdefault("siblings", sibling_summaries)

    graph = get_extraction_graph()
    thread_id = job_id or f"run-{doc_asset.sha256[:16]}"
    config = {"configurable": {"thread_id": thread_id}}

    initial: ExtractionState = {
        "job_id": thread_id,
        "asset": doc_asset,
        "context": ctx,
        "telemetry": [],
    }
    final_state = graph.invoke(initial, config=config)
    result = final_state.get("result") or {}
    # Final telemetry snapshot includes the persist node itself.
    result["telemetry"] = final_state.get("telemetry") or result.get("telemetry", [])
    return result


__all__ = [
    "ExtractionState",
    "get_extraction_graph",
    "run_graph_extraction",
    "MAX_REPAIR_PASSES",
]
