"""LangGraph orchestration for the deterministic layout-first pipeline.

    PDF
     ├── PDF-native extraction (words/spans/lines/blocks/fonts/images)
     ├── OCR / Vision (per-block)
     └── Layout Detection (providers)
          ↓
     Candidate Regions
          ↓
     Atomic Element Extraction (lines/spans from coarse blocks)
          ↓
     Visual Enrichment (background/design/QR/level_badge)
          ↓
     Element Classification (rules-first)
          ↓
     Deduplication / Overlap Resolution (type-pair aware)
          ↓
     Reading Order (column-aware, geometric)
          ↓
     Semantic Grouping (exercise segmentation) → preserved with atomicElements
          ↓
     Exercise Detection (typed) → Knowledge Graph → Storage

Guarantees (per rebuild spec):

* every node emits structured JSON (partial state updates),
* every node is independently callable/testable,
* execution time + confidence scores logged into ``telemetry``,
* retries per node (``NODE_RETRIES``, default 2),
* compile-once graph with checkpointer (resumable runs),
* LLM usage minimized: rules everywhere; LLM only bounded tie-breaks
  (classification / exercise typing / image descriptions).
* Hierarchical debug layers: raw → atomic → classified → groups → exercises
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Callable, TypedDict

from langgraph.graph import END, StateGraph

from . import classify as classify_mod
from . import crops as crops_mod
from . import exercises as ex_mod
from . import knowledge_graph
from . import ocr as ocr_mod
from . import reading_order
from . import relationships as rel_mod
from . import vision_images
from .providers import Region, resolve_provider_for_page
from .types import (
    AudioReference,
    DocumentBundle,
    LayoutBlock,
    SemanticGroup,
    VALID_BLOCK_TYPES,
)

logger = logging.getLogger(__name__)

NODE_RETRIES = max(0, int(os.environ.get("NODE_RETRIES", "2")))
RETRY_BACKOFF_S = float(os.environ.get("NODE_RETRY_BACKOFF_S", "0.5"))


class LayoutState(TypedDict, total=False):
    job_id: str
    file_id: str
    filename: str
    pdf_path: str
    sha256: str
    course_id: str
    context: dict[str, Any]

    bundle: DocumentBundle

    telemetry: list[dict[str, Any]]


# Heavy render artifacts (PIL images, crops, OCR index) are NOT stored in
# LangGraph state — msgpack cannot serialize Image objects. They live in a
# side-channel keyed by thread_id.
_RUNTIME: dict[str, dict[str, Any]] = {}


def _runtime_for(job_id: str) -> dict[str, Any]:
    if job_id not in _RUNTIME:
        _RUNTIME[job_id] = {}
    return _RUNTIME[job_id]


# ---------------------------------------------------------------------------
# Graph construction (compile-once)
# ---------------------------------------------------------------------------

_COMPILED: Any = None


def get_layout_graph() -> Any:
    global _COMPILED
    if _COMPILED is not None:
        return _COMPILED

    workflow = StateGraph(LayoutState)

    def _timed(name: str, fn: Callable[[LayoutState], dict[str, Any]]):
        def wrapped(state: LayoutState) -> dict[str, Any]:
            started_at = time.time()
            started = time.monotonic()
            status, error = "ok", None
            update: dict[str, Any] = {}
            try:
                update = _with_retries(name, fn, state) or {}
                return update
            except Exception as exc:  # noqa: BLE001
                status, error = "error", str(exc)
                logger.exception("Layout node %s failed", name)
                raise
            finally:
                entry: dict[str, Any] = {
                    "node": name,
                    "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(started_at)),
                    "duration_ms": round((time.monotonic() - started) * 1000, 1),
                    "status": status,
                }
                if error:
                    entry["error"] = error
                confidences = update.get("_confidences")
                if confidences:
                    entry["confidence"] = {
                        "avg": round(sum(confidences) / len(confidences), 3),
                        "min": round(min(confidences), 3),
                        "n": len(confidences),
                    }
                    update.pop("_confidences", None)
                update["telemetry"] = list(state.get("telemetry") or []) + [entry]
        return wrapped

    workflow.add_node("pdf_loader", _timed("pdf_loader", node_pdf_loader))
    workflow.add_node("layout_detection", _timed("layout_detection", node_layout_detection))
    workflow.add_node("atomic_extraction", _timed("atomic_extraction", node_atomic_extraction))
    workflow.add_node("block_extraction", _timed("block_extraction", node_block_extraction))
    workflow.add_node("ocr", _timed("ocr", node_ocr))
    workflow.add_node("classification", _timed("classification", node_classification))
    workflow.add_node("overlap_resolution", _timed("overlap_resolution", node_overlap_resolution))
    workflow.add_node("relationships", _timed("relationships", node_relationships))
    workflow.add_node("knowledge_graph", _timed("knowledge_graph", node_knowledge_graph))
    workflow.add_node("exercise_detection", _timed("exercise_detection", node_exercise_detection))
    workflow.add_node("semantic_grouping", _timed("semantic_grouping", node_semantic_grouping))
    workflow.add_node("storage", _timed("storage", node_storage))

    workflow.set_entry_point("pdf_loader")
    workflow.add_edge("pdf_loader", "layout_detection")
    workflow.add_edge("layout_detection", "atomic_extraction")
    workflow.add_edge("atomic_extraction", "block_extraction")
    workflow.add_edge("block_extraction", "ocr")
    workflow.add_edge("ocr", "classification")
    workflow.add_edge("classification", "overlap_resolution")
    workflow.add_edge("overlap_resolution", "relationships")
    workflow.add_edge("relationships", "knowledge_graph")
    workflow.add_edge("knowledge_graph", "exercise_detection")
    workflow.add_edge("exercise_detection", "semantic_grouping")
    workflow.add_edge("semantic_grouping", "storage")
    workflow.add_edge("storage", END)

    _COMPILED = workflow.compile(checkpointer=_make_checkpointer())
    return _COMPILED


def _make_checkpointer() -> Any:
    db_path = os.environ.get("LAYOUT_CHECKPOINT_DB")
    if db_path:
        try:
            from langgraph.checkpoint.sqlite import SqliteSaver

            conn = __import__("sqlite3").connect(db_path, check_same_thread=False)
            return SqliteSaver(conn)
        except ImportError:
            logger.warning("LAYOUT_CHECKPOINT_DB set but langgraph-checkpoint-sqlite not installed")
    from langgraph.checkpoint.memory import MemorySaver

    return MemorySaver()


def _with_retries(
    name: str,
    fn: Callable[[LayoutState], dict[str, Any]],
    state: LayoutState,
) -> dict[str, Any]:
    """Node-level retry with linear backoff."""
    last_exc: Exception | None = None
    for attempt in range(NODE_RETRIES + 1):
        try:
            return fn(state)
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt < NODE_RETRIES:
                logger.warning("Node %s failed (attempt %d/%d): %s", name, attempt + 1, NODE_RETRIES + 1, exc)
                time.sleep(RETRY_BACKOFF_S * (attempt + 1))
    assert last_exc is not None
    raise last_exc


# ---------------------------------------------------------------------------
# Nodes (pure-ish functions: state in -> partial update out)
# ---------------------------------------------------------------------------


def node_pdf_loader(state: LayoutState) -> dict[str, Any]:
    """Stage 1: render pages, read dimensions + text-layer profile. No classification."""
    pages, images, all_digital = crops_mod.load_pdf_pages(state["pdf_path"])
    bundle: DocumentBundle = state["bundle"]
    bundle.pages = pages
    bundle.page_count = len(pages)
    rt = _runtime_for(state["job_id"])
    rt["page_images"] = images
    rt["all_digital"] = all_digital
    return {
        "_confidences": [1.0],
        "quality": {"pages_rendered": len(pages), "render_dpi": pages[0].render_dpi if pages else 0},
    }


def node_layout_detection(state: LayoutState) -> dict[str, Any]:
    """Stage 2: detect every visual element with coordinates (provider-based)."""
    rt = _runtime_for(state["job_id"])
    images: dict[int, Any] = rt.get("page_images") or {}
    bundle: DocumentBundle = state["bundle"]

    import pymupdf

    doc = pymupdf.open(state["pdf_path"])
    try:
        regions_by_page: dict[int, list[Region]] = {}
        provider_counts: dict[str, int] = {}
        confidences: list[float] = []
        for model in bundle.pages:
            provider_name, provider = resolve_provider_for_page(model.has_text_layer)
            # Benchmark mode: forced provider must not silently fall back
            forced = os.environ.get("LAYOUT_FORCE_PROVIDER", "").strip()
            if provider is None and forced:
                raise RuntimeError(
                    f"Forced provider '{forced}' is not available. "
                    f"Check that its dependencies/config are installed "
                    f"({forced}={'GOOGLE_APPLICATION_CREDENTIALS/GOOGLE_CLOUD_PROJECT/DOCAI_LAYOUT_PROCESSOR_ID' if forced=='documentai' else 'paddleocr' if forced=='paddle_structure' else 'surya-ocr' if forced=='surya' else 'pymupdf'})."
                )
            pdf_page = doc[model.page - 1] if provider_name in ("pymupdf", "documentai") else None
            regions: list[Region] = []
            if provider is not None:
                try:
                    regions = provider.detect_page(images[model.page], model.page, pdf_page)
                except Exception as exc:  # noqa: BLE001
                    if forced and provider_name == "documentai":
                        raise RuntimeError(
                            f"Google Document AI {provider_name} failed on page {model.page}: "
                            f"{str(exc).splitlines()[0] or type(exc).__name__}"
                        ) from exc
                    logger.warning("Provider %s failed on page %d: %s", provider_name, model.page, type(exc).__name__)
                    regions = []
            if not regions:
                if forced:
                    raise RuntimeError(f"Forced provider '{forced}' returned no regions on page {model.page}")
                fallback = _fallback_regions(images[model.page])
                regions = fallback
                provider_name = f"{provider_name}+blank"
            regions_by_page[model.page] = regions
            provider_counts[provider_name] = provider_counts.get(provider_name, 0) + 1
            confidences.extend(r.confidence for r in regions)
    finally:
        doc.close()
        if os.environ.get("DOCAI_MODE", "image").strip().lower() == "pdf":
            from .providers.documentai import clear_document_cache

            clear_document_cache()

    # Store raw detector output for debug layer before atomic decomposition
    rt["raw_regions_by_page"] = {k: list(v) for k, v in regions_by_page.items()}
    rt["raw_provider_counts"] = dict(provider_counts)

    crops_mod.build_blocks_from_regions(regions_by_page, bundle.pages)
    primary = max(provider_counts, key=lambda k: provider_counts[k]) if provider_counts else "none"
    bundle.providers_used["layout"] = primary
    bundle.quality["layout_provider_counts"] = provider_counts
    bundle.quality["blocks_detected"] = len(bundle.all_blocks())
    # Preserve raw for debug: flatten to dicts
    bundle.debug_layers["raw_detector"] = {
        str(k): [{"bbox": list(r.bbox), "type": r.type_hint, "confidence": r.confidence, "source": r.source, "text": r.text[:200]} for r in v]
        for k, v in regions_by_page.items()
    }

    taxonomy: dict[str, int] = {}
    for b in bundle.all_blocks():
        b.type = b.type if b.type in VALID_BLOCK_TYPES else "unknown"
        taxonomy[b.type] = taxonomy.get(b.type, 0) + 1
    bundle.quality["layout_taxonomy"] = taxonomy
    return {
        "_confidences": confidences or [0.5],
        "quality": {"providers_used": provider_counts},
    }


def node_atomic_extraction(state: LayoutState) -> dict[str, Any]:
    """Atomic Element Extraction — core fix for oversized regions.

    Decomposes large layout blocks (paragraph with 3 lines) into per-line
    atomic elements using provider geometry (PDF spans/lines preferred).
    Also enriches visual/background/design elements (QR, level_badge, etc.).
    """
    from .atomic import decompose_regions_to_atomic, enrich_visual_and_background

    bundle: DocumentBundle = state["bundle"]
    rt = _runtime_for(state["job_id"])
    total_before = 0
    total_after = 0
    atomic_taxonomy: dict[str, int] = {}
    oversized_before = 0

    for page in bundle.pages:
        before = list(page.blocks)
        total_before += len(before)
        # Estimate oversized before decomposition
        page_area = float(page.width) * float(page.height)
        for b in before:
            if (b.bbox[2]-b.bbox[0])*(b.bbox[3]-b.bbox[1]) / page_area > 0.12 and b.text and b.text.count("\n") >= 2:
                oversized_before += 1

        # Convert LayoutBlock -> Region for atomic module
        coarse_regions: list[Region] = []
        for b in before:
            # Preserve block_id in meta for parent traceability
            meta = dict(b.meta or {})
            meta["block_id"] = b.block_id
            # Keep spans for pymupdf lines
            spans_dicts = [{"text": s.text, "bbox": list(s.bbox), "font_name": s.font_name, "font_size": s.font_size} for s in b.spans]
            coarse_regions.append(
                Region(
                    bbox=b.bbox,
                    type_hint=b.type,
                    confidence=b.confidence,
                    source=b.source or "layout",
                    text=b.text,
                    spans=spans_dicts,
                    meta=meta,
                )
            )
        # Decompose text regions into atomic lines
        decomposed = decompose_regions_to_atomic(coarse_regions, float(page.width), float(page.height))
        # Visual/background enrichment (QR, level_badge, background)
        enriched = enrich_visual_and_background(decomposed, float(page.width), float(page.height))
        total_after += len(enriched)
        for r in enriched:
            atomic_taxonomy[r.type_hint] = atomic_taxonomy.get(r.type_hint, 0) + 1

        # Rebuild LayoutBlocks with hierarchical ids: page_XXX_block_YYY[_line_Z]
        new_blocks: list[LayoutBlock] = []
        # Need TextSpan conversion helpers
        from .types import LayoutBlock as LB, TextSpan
        for idx, region in enumerate(enriched):
            meta = dict(region.meta or {})
            atomic_level = meta.get("atomic_level", "block")
            parent_id = meta.get("parent_id")
            # Stable id: if atomic line, append _Lxx
            if atomic_level.startswith("line"):
                line_idx = meta.get("line_index", 0)
                # Use parent block id as base if available
                base = parent_id if parent_id and parent_id.startswith("page_") else f"page_{page.page:03d}_block_{idx:03d}"
                block_id = f"{base}_L{line_idx:02d}" if "_" in base else f"page_{page.page:03d}_block_{idx:03d}_L{line_idx:02d}"
            else:
                # For non-split, keep deterministic page_block idx but ensure uniqueness
                block_id = f"page_{page.page:03d}_block_{idx:03d}"
                # If region had original block_id and atomic_level==block and text same, preserve id for provenance
                orig = meta.get("block_id")
                if orig and len(enriched) == len(before) and idx < len(before):
                    # Keep orig only if we didn't split — preserve id stability
                    if atomic_level == "block" and region.text == before[idx].text:
                        block_id = orig

            spans_objs = []
            for s in region.spans or []:
                try:
                    bbox = tuple(float(v) for v in s.get("bbox", [0,0,0,0]))  # type: ignore
                    if len(bbox)==4:
                        spans_objs.append(TextSpan(text=s.get("text",""), bbox=bbox, font_name=s.get("font_name",""), font_size=float(s.get("font_size",0) or 0)))
                except Exception:
                    continue
            subtype = meta.get("subtype")
            # Map enriched type_hint to canonical VALID_BLOCK_TYPES — extra types are allowed now
            lb_type = region.type_hint if region.type_hint in VALID_BLOCK_TYPES else "unknown"
            # But preserve enriched precise type in subtype if needed
            if region.type_hint not in VALID_BLOCK_TYPES:
                subtype = region.type_hint
                lb_type = "unknown" if region.type_hint in ("background", "design_element") else lb_type
                # Keep concrete image/design types as direct type now that taxonomy extended
                if region.type_hint in VALID_BLOCK_TYPES:
                    lb_type = region.type_hint
                else:
                    # Extended types are now valid, keep them
                    lb_type = region.type_hint
            # For level_badge, set type design_element
            if meta.get("subtype") == "level_badge":
                lb_type = "design_element"
                subtype = "level_badge"

            provenance = meta.get("provenance") or [region.source]
            detectors = list(set(provenance + [region.source]))

            new_blocks.append(
                LB(
                    block_id=block_id,
                    page=page.page,
                    type=lb_type,
                    bbox=region.bbox,
                    confidence=region.confidence,
                    text=region.text,
                    source=region.source,
                    spans=spans_objs,
                    meta=meta,
                    parent_id=parent_id if atomic_level.startswith("line") else None,
                    subtype=subtype,
                    provenance=provenance,
                    detectors=detectors,  # type: ignore
                )
            )
        # Replace page blocks with atomic set (but preserve raw count for debug)
        page.blocks = new_blocks

    bundle.quality["atomic_extraction"] = {
        "blocks_before": total_before,
        "blocks_after": total_after,
        "oversized_before": oversized_before,
        "taxonomy": atomic_taxonomy,
    }
    bundle.quality["oversized_region_rate_before"] = round(oversized_before / max(1, total_before), 3)
    bundle.providers_used["atomic"] = "deterministic"
    # Save atomic elements separately for inspector (deep copy)
    bundle.atomic_elements = [b for p in bundle.pages for b in p.blocks]
    bundle.debug_layers["atomic_elements"] = [
        {"block_id": b.block_id, "page": b.page, "type": b.type, "subtype": b.subtype, "bbox": list(b.bbox), "text": b.text[:120], "parentId": b.parent_id, "confidence": b.confidence, "source": b.source}
        for b in bundle.atomic_elements
    ]

    return {
        "_confidences": [b.confidence for b in bundle.atomic_elements] or [0.5],
        "quality": {"atomic_blocks": total_after, "decomposition_ratio": round(total_after / max(1, total_before), 2)},
    }


def _fallback_regions(image: Any) -> list[Region]:
    """A blank page still gets one full-page unknown block (coordinates mandatory)."""
    w, h = image.size
    return [Region(bbox=(0.0, 0.0, float(w), float(h)), type_hint="unknown", confidence=0.2, source="blank")]


def node_block_extraction(state: LayoutState) -> dict[str, Any]:
    """Stage 3: column-aware reading order + crop every block independently."""
    rt = _runtime_for(state["job_id"])
    images: dict[int, Any] = rt.get("page_images") or {}
    bundle: DocumentBundle = state["bundle"]

    ordered_ids: list[str] = []
    for page in bundle.pages:
        ordered = reading_order.order_page_blocks(page.blocks, float(page.width))
        page.blocks = ordered
        ordered_ids.extend(b.block_id for b in ordered)
    bundle.reading_order = ordered_ids

    crops = crops_mod.crop_blocks(images, bundle.pages)
    rt["crops"] = crops
    return {
        "_confidences": [1.0],
        "quality": {"blocks_cropped": len(crops), "reading_order_entries": len(ordered_ids)},
    }


def node_ocr(state: LayoutState) -> dict[str, Any]:
    """Stage 4: OCR per BLOCK (never whole pages); text-layer blocks skip OCR."""
    rt = _runtime_for(state["job_id"])
    crops: dict[str, Any] = rt.get("crops") or {}
    bundle: DocumentBundle = state["bundle"]
    blocks = bundle.all_blocks()

    docai_texts: dict[str, tuple[str, float]] = {}
    if bundle.providers_used.get("layout", "").startswith("documentai"):
        for b in blocks:
            if b.text:
                docai_texts[b.block_id] = (b.text, b.confidence)

    results = ocr_mod.run_block_ocr(blocks, crops, docai_texts=docai_texts)
    bundle.ocr = results
    ocr_by_block = {r.block_id: r.text for r in results}
    rt["ocr_by_block"] = ocr_by_block
    engines = sorted({r.engine for r in results})
    bundle.providers_used["ocr"] = engines[0] if engines else "none"
    return {
        "_confidences": [r.confidence for r in results] or [1.0],
        "quality": {"ocr_blocks": len(results), "ocr_engines": engines},
    }


def node_classification(state: LayoutState) -> dict[str, Any]:
    """Stage 5: rules-first classification; bounded LLM tie-break.

    Operates on ATOMIC elements so each line gets its own semantic type
    (Kontext→title, Deutsch als Fremdsprache→subtitle, etc.).
    """
    rt = _runtime_for(state["job_id"])
    bundle: DocumentBundle = state["bundle"]
    ocr_by_block: dict[str, str] = rt.get("ocr_by_block") or {}
    page_heights = {p.page: float(p.height) for p in bundle.pages}

    classify_mod.reset_llm_budget()
    classifications, llm_calls = classify_mod.classify_blocks(
        bundle.pages, ocr_by_block, page_heights=page_heights
    )
    bundle.classifications = classifications
    bundle.llm_calls += llm_calls
    bundle.debug_layers["classified_elements"] = [
        {"block_id": c.block_id, "category": c.category, "confidence": c.confidence, "method": c.method, "signals": c.signals}
        for c in classifications
    ]
    return {
        "_confidences": [c.confidence for c in classifications] or [1.0],
        "quality": {"classified_blocks": len(classifications), "classification_llm_calls": llm_calls},
    }


def node_overlap_resolution(state: LayoutState) -> dict[str, Any]:
    """Deduplication / Overlap Resolution with type-pair aware rules.

    Must run AFTER classification so rules can discriminate text↔image vs text↔text.
    Preserves nested semantic elements (e.g., B2 inside red panel).
    """
    from .atomic import compute_evaluation, resolve_overlaps
    from .providers import Region

    bundle: DocumentBundle = state["bundle"]
    total_before = sum(len(p.blocks) for p in bundle.pages)
    total_removed = 0
    taxonomy_before: dict[str, int] = {}
    for b in bundle.all_blocks():
        taxonomy_before[b.type] = taxonomy_before.get(b.type, 0) + 1

    for page in bundle.pages:
        # Convert blocks to Regions with current classified type
        regions: list[Region] = []
        for b in page.blocks:
            meta = dict(b.meta or {})
            meta["block_id"] = b.block_id
            if b.subtype:
                meta["subtype"] = b.subtype
            # Use classified category as confidence adjustment? keep b.type
            spans_dicts = [{"text": s.text, "bbox": list(s.bbox), "font_name": s.font_name, "font_size": s.font_size} for s in b.spans]
            regions.append(Region(bbox=b.bbox, type_hint=b.type, confidence=b.confidence, source=b.source, text=b.text, spans=spans_dicts, meta=meta))
        resolved = resolve_overlaps(regions, float(page.width), float(page.height))
        total_removed += len(regions) - len(resolved)

        # Convert back, preserving hierarchical fields
        from .types import LayoutBlock as LB, TextSpan
        new_blocks: list[LB] = []
        for r in resolved:
            meta = dict(r.meta or {})
            block_id = meta.get("block_id", f"page_{page.page:03d}_block_{len(new_blocks):03d}")
            spans_objs = []
            for s in r.spans or []:
                try:
                    bbox = tuple(float(v) for v in s.get("bbox", [0,0,0,0]))
                    if len(bbox)==4:
                        spans_objs.append(TextSpan(text=s.get("text",""), bbox=bbox, font_name=s.get("font_name",""), font_size=float(s.get("font_size",0) or 0)))
                except Exception:
                    continue
            # need original to keep parent/subtype/provenance
            orig = next((b for b in page.blocks if b.block_id == block_id), None)
            new_blocks.append(
                LB(
                    block_id=block_id,
                    page=page.page,
                    type=r.type_hint,
                    bbox=r.bbox,
                    confidence=r.confidence,
                    text=r.text,
                    source=r.source,
                    spans=spans_objs,
                    meta=meta,
                    parent_id=orig.parent_id if orig else None,
                    subtype=orig.subtype if orig and orig.subtype else meta.get("subtype"),
                    provenance=orig.provenance if orig and orig.provenance else [r.source],
                    detectors=orig.detectors if orig and orig.detectors else [r.source],
                )
            )
        page.blocks = new_blocks
        # Re-compute reading order for this page after dedup (still keep global later)
        from . import reading_order as ro_mod
        page.blocks = ro_mod.order_page_blocks(page.blocks, float(page.width))
        # Assign readingOrder per block on this page
        base_order = sum(len(p.blocks) for p in bundle.pages if p.page < page.page)
        for idx, b in enumerate(page.blocks):
            b.reading_order = base_order + idx + 1

    # Rebuild global reading order
    bundle.reading_order = [b.block_id for p in sorted(bundle.pages, key=lambda p: p.page) for b in p.blocks]

    # Evaluation metrics including oversized_region_rate (core failure metric)
    evals = []
    for page in bundle.pages:
        regions = []
        for b in page.blocks:
            regions.append(Region(bbox=b.bbox, type_hint=b.type, confidence=b.confidence, source=b.source, text=b.text, spans=[], meta=b.meta))
        ev = compute_evaluation(regions, float(page.width), float(page.height))
        evals.append(ev)
    total = sum(e.total_elements for e in evals)
    oversized = sum(e.oversized_regions for e in evals)
    avg_rate = oversized / max(1, total)
    bundle.evaluation = {
        "total_elements": total,
        "oversized_regions": oversized,
        "oversized_region_rate": round(avg_rate, 3),
        "duplicate_rate": round(sum(e.duplicate_rate for e in evals)/max(1, len(evals)), 3),
        "avg_bbox_area_ratio": round(sum(e.avg_bbox_area_ratio for e in evals)/max(1, len(evals)), 4),
        "atomic_coverage": round(sum(e.atomic_coverage for e in evals)/max(1, len(evals)), 3),
        "background_count": sum(e.background_count for e in evals),
        "design_element_count": sum(e.design_element_count for e in evals),
        "removed_duplicates": total_removed,
        "taxonomy_after": {b.type: sum(1 for p in bundle.pages for bb in p.blocks if bb.type==b.type) for b in bundle.all_blocks()},
    }
    bundle.quality["overlap_resolution"] = {
        "removed": total_removed,
        "total_after": total,
        "oversized_rate": round(avg_rate, 3),
        "taxonomy": bundle.evaluation["taxonomy_after"],
    }
    bundle.quality["oversized_region_rate"] = round(avg_rate, 3)
    # Store resolved as debug layer and refresh atomic_elements
    bundle.atomic_elements = [b for p in bundle.pages for b in p.blocks]
    bundle.debug_layers["resolved_elements"] = [
        {"block_id": b.block_id, "page": b.page, "type": b.type, "subtype": b.subtype, "bbox": list(b.bbox), "text": b.text[:120], "readingOrder": b.reading_order}
        for b in bundle.atomic_elements
    ]
    # Backgrounds must not enter exercise pipeline — mark quality
    bg_count = bundle.evaluation["background_count"]
    if bg_count:
        bundle.quality["background_excluded"] = bg_count

    return {
        "_confidences": [b.confidence for b in bundle.atomic_elements] or [1.0],
        "quality": {"resolved_blocks": total, "oversized_rate": round(avg_rate, 3), "removed": total_removed},
    }


def node_relationships(state: LayoutState) -> dict[str, Any]:
    """Stages 6+7: image understanding (vision, image blocks only), audio/video
    reference extraction, exercise region segmentation and relationship edges."""
    rt = _runtime_for(state["job_id"])
    crops: dict[str, Any] = rt.get("crops") or {}
    bundle: DocumentBundle = state["bundle"]
    blocks = bundle.all_blocks()
    blocks_by_id = {b.block_id: b for b in blocks}

    # --- Media references (deterministic regex pass over text blocks). ---
    audio_refs = ex_mod.extract_media_refs(blocks)
    bundle.audio_refs = audio_refs
    audio_ids = {r.ref_id for r in audio_refs}

    # --- Image understanding: vision ONLY here. ---
    image_blocks = [b for b in blocks if b.type == "image"]
    understandings, vision_calls = vision_images.understand_images(image_blocks, crops)
    bundle.images = understandings
    bundle.llm_calls += vision_calls

    # --- Exercise region segmentation (shells; typing finalized later). ---
    shells = ex_mod.segment_exercises(
        bundle.reading_order,
        blocks_by_id,
        file_id=bundle.file_id,
        filename=bundle.filename,
        sha256=bundle.sha256,
        audio_refs=audio_refs,
    )
    bundle.exercises = shells

    # --- Relationship edges. ---
    rels = rel_mod.build_relationships(shells, blocks_by_id, audio_refs, bundle.reading_order)
    bundle.relationships = rels
    bundle.quality["audio_references"] = len(audio_ids)
    bundle.quality["image_blocks"] = len(image_blocks)
    return {
        "_confidences": [r.confidence for r in rels] or [1.0],
        "quality": {
            "exercises_segmented": len(shells),
            "relationships": len(rels),
            "vision_calls": vision_calls,
        },
    }


def node_knowledge_graph(state: LayoutState) -> dict[str, Any]:
    """Stage 8: Lesson/Exercise/Question/Image/Audio/Video/Solution/Grammar/
    Vocabulary/Dialogue nodes with HAS_* / BELONGS_TO / RELATED_TO edges."""
    bundle: DocumentBundle = state["bundle"]
    blocks_by_id = {b.block_id: b for b in bundle.all_blocks()}
    bundle.knowledge_graph = knowledge_graph.build_graph(bundle, blocks_by_id)
    kg = bundle.knowledge_graph
    return {
        "_confidences": [l.get("confidence", 0.5) for l in kg.get("links", [])] or [1.0],
        "quality": {"kg_nodes": len(kg.get("nodes", [])), "kg_links": len(kg.get("links", []))},
    }


def node_exercise_detection(state: LayoutState) -> dict[str, Any]:
    """Stage 9: finalize typed exercises (type + confidence, prompt, solutions)
    and validate coverage quality gates.

    Consumes atomicElements + readingOrder + classifications (NOT raw coarse detector).
    Background blocks are excluded explicitly.
    """
    rt = _runtime_for(state["job_id"])
    bundle: DocumentBundle = state["bundle"]
    # Exclude background/design decorative from exercise consumption — per spec, backgrounds must not enter pipeline
    non_bg_blocks = [b for b in bundle.all_blocks() if b.type != "background" and b.meta.get("subtype") != "background"]
    blocks_by_id = {b.block_id: b for b in non_bg_blocks}
    ocr_by_block: dict[str, str] = rt.get("ocr_by_block") or {}

    ex_mod.finalize_exercises(
        bundle.exercises,
        blocks_by_id=blocks_by_id,
        ocr_by_block=ocr_by_block,
        llm_budget_reset=True,
    )
    bundle.llm_calls += ex_mod.last_llm_call_count()

    covered = set()
    for ex in bundle.exercises:
        covered.update([ex.instruction_block, *ex.question_blocks, *ex.image_blocks])

    total_pages = max((p.page for p in bundle.pages), default=0)
    exercise_pages = {ex.page_start for ex in bundle.exercises}
    content_blocks = [b for b in bundle.all_blocks() if b.type != "unknown"]
    content_pages = {b.page for b in content_blocks}
    coverage = len(exercise_pages | content_pages) / total_pages if total_pages else 0.0

    bundle.quality.update({
        "exercises_detected": len(bundle.exercises),
        "coverage": round(coverage, 3),
        "pages_total": total_pages,
        "pages_with_content": len(content_pages),
        "type_taxonomy": _type_histogram(bundle.exercises),
    })
    issues: list[str] = []
    if total_pages >= 10 and coverage < 0.1:
        issues.append("low_page_coverage")
    if bundle.llm_calls > 60:
        issues.append("excessive_llm_usage")
    # Oversized region is the core failure metric
    if bundle.evaluation.get("oversized_region_rate", 0) > 0.15:
        issues.append("oversized_regions_detected")
    bundle.quality["issues"] = issues
    return {
        "_confidences": [e.type_confidence for e in bundle.exercises] or [1.0],
        "quality": {"exercises_finalized": len(bundle.exercises), "coverage": round(coverage, 3)},
    }


def node_semantic_grouping(state: LayoutState) -> dict[str, Any]:
    """Semantic Grouping — only AFTER atomic detection & classification.

    Groups related atomic elements (Instruction→Question→Media→Image) into
    SemanticGroups while PRESERVING every atomic element. Downstream
    LangChain/LangGraph reasoning consumes both layers.
    """
    bundle: DocumentBundle = state["bundle"]
    rt = _runtime_for(state["job_id"])
    blocks_by_id = {b.block_id: b for b in bundle.all_blocks()}

    groups: list[SemanticGroup] = []
    # One group per exercise (primary semantic unit)
    for ex in bundle.exercises:
        members = [mid for mid in [ex.instruction_block] + ex.question_blocks + ex.image_blocks + ex.answer_area_blocks if mid and mid in blocks_by_id]
        if not members:
            continue
        # Union bbox of members
        bboxes = [blocks_by_id[mid].bbox for mid in members]
        x0 = min(b[0] for b in bboxes)
        y0 = min(b[1] for b in bboxes)
        x1 = max(b[2] for b in bboxes)
        y1 = max(b[3] for b in bboxes)
        groups.append(SemanticGroup(
            id=ex.exercise_id,
            type="exercise",
            member_ids=members,
            bbox=(x0, y0, x1, y1),
            confidence=ex.confidence,
            label=ex.name or ex.exercise_type,
        ))
    # Additional column/group for reading-order column clusters (per page)
    for page in bundle.pages:
        # Use atomic blocks to find column clusters — simple two-column split
        cols = _clusters_for_page(page)
        for ci, col in enumerate(cols):
            if len(col) < 2:
                continue
            x0 = min(blocks_by_id[bid].bbox[0] for bid in col if bid in blocks_by_id)
            y0 = min(blocks_by_id[bid].bbox[1] for bid in col if bid in blocks_by_id)
            x1 = max(blocks_by_id[bid].bbox[2] for bid in col if bid in blocks_by_id)
            y1 = max(blocks_by_id[bid].bbox[3] for bid in col if bid in blocks_by_id)
            groups.append(SemanticGroup(
                id=f"page_{page.page:03d}_col_{ci}",
                type="column",
                member_ids=col,
                bbox=(x0, y0, x1, y1),
                confidence=0.7,
                label=f"Column {ci+1}",
            ))

    bundle.semantic_groups = groups
    bundle.debug_layers["semantic_groups"] = [g.to_dict() for g in groups]
    # Preserve atomicElements array explicitly (already in atomic_elements)
    bundle.debug_layers["atomic_elements_final"] = [
        {"block_id": b.block_id, "page": b.page, "type": b.type, "subtype": b.subtype, "bbox": list(b.bbox), "text": b.text[:120], "readingOrder": b.reading_order, "parentId": b.parent_id}
        for b in bundle.atomic_elements
    ]
    return {
        "_confidences": [g.confidence for g in groups] or [1.0],
        "quality": {"semantic_groups": len(groups), "exercise_groups": len(bundle.exercises)},
    }


def _clusters_for_page(page) -> list[list[str]]:
    """Cheap column clustering for semantic grouping debug."""
    if len(page.blocks) < 4:
        return [[b.block_id for b in page.blocks]]
    centers = sorted(((b.bbox[0]+b.bbox[2])/2, b.block_id) for b in page.blocks)
    vals = [c for c,_ in centers]
    occ = max(vals[-1]-vals[0], 1.0)
    gaps = [(vals[i]-vals[i-1], i) for i in range(1,len(vals))]
    if not gaps:
        return [[b.block_id for b in page.blocks]]
    best_gap, idx = max(gaps, key=lambda x: x[0])
    if best_gap < page.width*0.06 or best_gap < occ*0.25:
        return [[b.block_id for b in page.blocks]]
    split_x = (vals[idx-1]+vals[idx])/2
    left = [bid for cx,bid in centers if cx < split_x]
    right = [bid for cx,bid in centers if cx >= split_x]
    if len(left)<2 or len(right)<2:
        return [[b.block_id for b in page.blocks]]
    return [left, right]


def _type_histogram(exercises: list[Any]) -> dict[str, int]:
    hist: dict[str, int] = {}
    for e in exercises:
        hist[e.exercise_type] = hist.get(e.exercise_type, 0) + 1
    return hist


def node_storage(state: LayoutState) -> dict[str, Any]:
    """Stage 10: persist bundle JSON + page renders + block crops."""
    rt = _runtime_for(state["job_id"])
    bundle: DocumentBundle = state["bundle"]
    artifacts = _store_bundle_safe(bundle, rt, state.get("course_id", ""))
    bundle.artifacts = artifacts
    _RUNTIME.pop(state["job_id"], None)
    return {
        "_confidences": [1.0],
        "quality": {"artifacts_document_json": bool(artifacts.get("document_json"))},
    }


def _store_bundle_safe(bundle: DocumentBundle, runtime: dict[str, Any], course_id: str) -> dict[str, Any]:
    from .storage import store_bundle

    return store_bundle(
        bundle,
        page_images=runtime.get("page_images") or {},
        crops=runtime.get("crops") or {},
        course_id=course_id,
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def run_layout_pipeline(
    pdf_path: str,
    *,
    file_id: str,
    filename: str | None = None,
    sha256: str = "",
    course_id: str = "",
    job_id: str | None = None,
    context: dict[str, Any] | None = None,
) -> DocumentBundle:
    """Run the full layout-first graph for ONE file and return its bundle."""
    display_name = filename or os.path.basename(pdf_path)
    bundle = DocumentBundle(
        file_id=file_id,
        filename=display_name,
        sha256=sha256,
        page_count=0,
    )
    graph = get_layout_graph()
    thread_id = job_id or f"layout-{file_id}"
    config = {"configurable": {"thread_id": thread_id}}
    initial: LayoutState = {
        "job_id": thread_id,
        "file_id": file_id,
        "filename": display_name,
        "pdf_path": pdf_path,
        "sha256": sha256,
        "course_id": course_id,
        "context": dict(context or {}),
        "bundle": bundle,
        "telemetry": [],
    }
    _RUNTIME[thread_id] = {}
    try:
        final_state = graph.invoke(initial, config=config)
    except Exception:
        _RUNTIME.pop(thread_id, None)
        raise
    result_bundle: DocumentBundle = final_state["bundle"]
    result_bundle.telemetry = final_state.get("telemetry") or result_bundle.telemetry
    return result_bundle


__all__ = [
    "LayoutState",
    "get_layout_graph",
    "run_layout_pipeline",
    "NODE_RETRIES",
]
