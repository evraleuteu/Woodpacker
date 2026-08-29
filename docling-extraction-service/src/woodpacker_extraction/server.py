"""FastAPI micro-service for the Woodpacker extraction pipeline.

Run with:
    python -m woodpacker_extraction.server
    uvicorn woodpacker_extraction.server:app --host 127.0.0.1 --port 8001

Listens on the port defined by the ``PORT`` env var (default 8001).
Endpoints:
    GET  /health             -> {"status": "ok", "engines": {...}}
    POST /extract/text       -> multipart/form-data "file" field
                                  -> {"text": "...", "pageCount": N, "fileName": "..."}
    POST /extract/image      -> multipart/form-data "file" (png/jpg/webp), Surya OCR
                                  -> {"text": "[PAGE 1]...", "engine": "surya"}
    POST /detect/layout      -> multipart "file"; stages 1-4 ONLY
                                  (page renders + provider layout + block crops +
                                  per-block OCR). No classification.
    POST /analyze            -> multipart "file"; FULL deterministic layout-first
                                  pipeline -> DocumentBundle JSON
    POST /analyze/object     -> JSON {"object_key", ...}; same, streamed from MinIO
    POST /extract            -> multipart "file" + "engine"
                                  ("layout" default | "legacy_graph")
    GET  /inspect/documents                -> artifact bundles index
    GET  /inspect/documents/{id}           -> stored document.json
    GET  /inspect/documents/{id}/pages/{n}/image.png
    GET  /inspect/documents/{id}/blocks/{block_id}.png

The Surya OCR predictor (VLM) is a process-wide singleton, so scanned-PDF
OCR keeps the model warm across requests (no per-request model loading).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Literal

import pymupdf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

logger = logging.getLogger(__name__)

from .extract_pdf import extract_pdf_bytes

app = FastAPI(
    title="Woodpacker Extraction Service",
    description="Deterministic layout-first PDF understanding pipeline "
                "(layout detection, per-block OCR, exercise grouping) + legacy seams.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB
MAX_IMAGE_BYTES = 25 * 1024 * 1024  # 25 MB

IMAGE_MIME_BY_SUFFIX = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}


def _health_engines() -> dict[str, str]:
    engines: dict[str, str] = {"pymupdf": "ok"}
    engines["llm"] = "ok" if os.environ.get("OPENCODE_API_KEY") else "unconfigured"
    engines["vision"] = "ok" if os.environ.get("OPENCODE_API_KEY") else "unconfigured"

    forced = os.environ.get("LAYOUT_FORCE_PROVIDER", "").strip()
    if forced:
        engines["layout:forced"] = forced
    try:
        from .layout.providers import get_provider

        for name in ("documentai", "paddle_structure", "surya", "pymupdf"):
            provider = get_provider(name)
            engines[f"layout:{name}"] = "ok" if provider and provider.available() else "unavailable"
        from .layout.providers.documentai import configuration_error, documentai_ocr_available

        engines["ocr:documentai"] = "ok" if documentai_ocr_available() else "unavailable"
        if engines["ocr:documentai"] == "unavailable":
            engines["ocr:documentai:reason"] = (
                configuration_error("ocr")
                or "google-cloud-documentai package is not installed"
            )
        if forced:
            forced_provider = get_provider(forced)
            if forced_provider is None:
                engines["layout:active"] = f"error: unknown provider {forced}"
            elif not forced_provider.available():
                engines["layout:active"] = f"error: {forced} not available"
                # Surface a safe configuration/dependency reason for the
                # Google DocAI inspector. Never include credential values.
                if forced == "documentai":
                    engines["layout:documentai:reason"] = (
                        configuration_error("layout")
                        or "google-cloud-documentai package is not installed"
                    )
                elif forced == "paddle_structure":
                    engines["layout:paddle_structure:reason"] = "paddleocr not installed"
                elif forced == "surya":
                    engines["layout:surya:reason"] = "surya-ocr not installed"
            else:
                engines["layout:active"] = forced
        else:
            engines["layout:active"] = os.environ.get("LAYOUT_PROVIDER_ORDER", "documentai,paddle_structure,surya")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Layout provider probe failed: %s", exc)

    binary = os.environ.get("LLAMA_CPP_BINARY") or "llama-server"
    binary_ok = Path(binary).is_file() if os.path.isabs(binary) else True
    try:
        import surya  # noqa: F401

        engines["surya"] = "ok" if binary_ok else "binary-missing"
    except Exception:
        engines["surya"] = "not-installed"
    return engines


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "engines": _health_engines()}


@app.post("/extract/image")
async def extract_image(file: UploadFile = File(...)) -> dict:
    """OCR a standalone image (screenshot/photo of a textbook page) with Surya.

    Returns ``{"text": "[PAGE 1]\\n...", "engine": "surya"}``. The ``[PAGE 1]``
    marker mirrors the PDF extraction format so downstream page attribution
    (splitPages in the Next.js pipeline) stays consistent.
    """
    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 25 MB)")

    suffix = Path(file.filename or "upload.png").suffix.lower()
    mime = IMAGE_MIME_BY_SUFFIX.get(suffix, file.content_type or "image/png")
    if mime not in set(IMAGE_MIME_BY_SUFFIX.values()):
        raise HTTPException(status_code=415, detail=f"Unsupported image type: {mime or 'unknown'}")

    try:
        from PIL import Image
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail="Pillow not installed") from exc

    import io

    try:
        img = Image.open(io.BytesIO(data))
        img = img.convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Image parse failed: {exc}") from exc

    try:
        from .ocr import ocr_image
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail="Surya OCR not installed") from exc

    try:
        text = await asyncio.to_thread(ocr_image, img)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"OCR failed: {exc}") from exc

    if not text or not text.strip():
        raise HTTPException(status_code=422, detail="No text recognized in image")

    return {"text": f"[PAGE 1]\n{text.strip()}", "engine": "surya", "fileName": file.filename or "image"}


@app.post("/extract/text")
async def extract_text(file: UploadFile = File(...)) -> dict:
    """Lightweight PyMuPDF text extraction (mirrors the old subprocess endpoint)."""
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 100 MB)")
    try:
        text, page_count = extract_pdf_bytes(data)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"PDF parse failed: {exc}") from exc
    return {"text": text, "pageCount": page_count, "fileName": file.filename or "file.pdf"}


# ---------------------------------------------------------------------------
# Layout-first deterministic pipeline endpoints
# ---------------------------------------------------------------------------


def _save_to_temp(data: bytes, filename: str) -> str:
    suffix = Path(filename or "file").suffix.lower() or ".pdf"
    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as f:
        f.write(data)
    return tmp_path


def _stages_partial(pdf_path: str, file_id: str, stages: int) -> dict:
    """Run only the first ``stages`` nodes of the layout graph (1-4)."""
    import pymupdf

    from .layout import classify as classify_mod
    from .layout import crops as crops_mod
    from .layout import ocr as ocr_mod
    from .layout import reading_order
    from .layout.providers import Region, resolve_provider_for_page
    from .layout.types import DocumentBundle

    bundle = DocumentBundle(file_id=file_id, filename=Path(pdf_path).name, sha256="", page_count=0)
    pages, images, _digital = crops_mod.load_pdf_pages(pdf_path)
    bundle.pages = pages
    bundle.page_count = len(pages)
    if stages < 2:
        return bundle.to_dict()

    doc = pymupdf.open(pdf_path)
    try:
        regions_by_page: dict[int, list[Region]] = {}
        for model in pages:
            provider_name, provider = resolve_provider_for_page(model.has_text_layer)
            forced = os.environ.get("LAYOUT_FORCE_PROVIDER", "").strip()
            if provider is None and forced:
                raise HTTPException(status_code=503, detail=f"Forced provider '{forced}' is not available (missing deps/config). This benchmark requires the forced engine to be installed/configured — not a silent fallback.")
            pdf_page = doc[model.page - 1] if provider_name in ("pymupdf", "documentai") else None
            regions: list[Region] = []
            if provider is not None:
                try:
                    regions = provider.detect_page(images[model.page], model.page, pdf_page)
                except Exception as exc:  # noqa: BLE001
                    if forced and provider_name == "documentai":
                        raise HTTPException(status_code=503, detail=str(exc)) from exc
                    regions = []
            if forced and not regions:
                raise HTTPException(status_code=500, detail=f"Forced provider '{forced}' returned no regions on page {model.page}")
            regions_by_page[model.page] = regions
    finally:
        try:
            doc.close()
        except Exception:
            pass
        if os.environ.get("DOCAI_MODE", "image").strip().lower() == "pdf":
            from .layout.providers.documentai import clear_document_cache

            clear_document_cache()

    crops_mod.build_blocks_from_regions(regions_by_page, pages)
    if stages < 3:
        return bundle.to_dict()

    for page in pages:
        page.blocks = reading_order.order_page_blocks(page.blocks, float(page.width))
    crops = crops_mod.crop_blocks(images, pages)
    if stages < 4:
        return bundle.to_dict()

    results = ocr_mod.run_block_ocr([b for p in pages for b in p.blocks], crops)
    bundle.ocr = results
    return bundle.to_dict()


@app.post("/detect/layout")
async def detect_layout(
    file: UploadFile = File(...),
    stages: int = Form(4),
) -> dict:
    """Stages 1-4 ONLY: page extraction + layout detection + block crops + OCR.

    No classification happens here — pure deterministic detection output for
    debugging providers and coordinates.
    """
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 100 MB)")
    tmp_path = _save_to_temp(data, file.filename or "file.pdf")
    try:
        result = await asyncio.to_thread(_stages_partial, tmp_path, f"upload-{int(asyncio.get_event_loop().time()*1000)}", max(1, min(4, stages)))
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        if "Google Document AI" in msg:
            raise HTTPException(status_code=503, detail=msg) from exc
        if "Forced provider" in msg and ("not available" in msg or "missing" in msg):
            raise HTTPException(status_code=503, detail=msg) from exc
        logger.exception("Layout detection failed")
        raise HTTPException(status_code=500, detail=f"Layout detection failed: {exc}") from exc
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
    return {"engine": "layout", "stages": max(1, min(4, stages)), "result": result}


def _run_full_analysis(
    pdf_path: str,
    file_id: str,
    *,
    filename: str | None = None,
    course_id: str = "",
    job_id: str | None = None,
    context: dict | None = None,
) -> tuple[dict, dict]:
    """Full deterministic pipeline -> (bundle_json, legacy_result_json)."""
    from .assets import sha256_file
    from .layout.pipeline import run_layout_analysis, to_legacy_result

    digest = sha256_file(pdf_path)
    bundle = run_layout_analysis(
        pdf_path,
        file_id=file_id,
        filename=filename or Path(pdf_path).name,
        sha256=digest,
        course_id=course_id,
        job_id=job_id,
        context=context,
    )
    return bundle, to_legacy_result(bundle, filename=filename)


@app.post("/analyze")
async def analyze_document(
    file: UploadFile = File(...),
    file_id: str = Form(""),
    course_id: str = Form(""),
) -> dict:
    """FULL deterministic layout-first analysis of an uploaded PDF."""
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 100 MB)")
    fid = file_id or f"upload-{abs(hash(file.filename or 'pdf')) % 10**8}"
    tmp_path = _save_to_temp(data, file.filename or "file.pdf")
    try:
        bundle, legacy = await asyncio.to_thread(
            _run_full_analysis, tmp_path, fid,
            filename=file.filename, course_id=course_id,
            job_id=f"analyze-{fid}",
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        if "Google Document AI" in msg:
            raise HTTPException(status_code=503, detail=msg) from exc
        if "Forced provider" in msg and ("not available" in msg or "not installed" in msg or "missing" in msg):
            raise HTTPException(status_code=503, detail=msg) from exc
        if "Forced provider" in msg and "no regions" in msg:
            raise HTTPException(status_code=500, detail=msg) from exc
        logger.exception("Analysis failed")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
    return {"engine": "layout", "bundle": bundle, "legacy": legacy}


@app.post("/analyze/object")
async def analyze_object(payload: dict) -> dict:
    """Analyze ONE stored object (streams it from MinIO itself).

    Body: {"object_key", "bucket"?, "file_id"?, "course_id"?}
    """
    from .storage_backend import MinioStorage, get_storage, validate_readable_key

    object_key = str(payload.get("object_key") or "")
    if not object_key:
        raise HTTPException(status_code=400, detail="object_key required")
    if not validate_readable_key(object_key):
        raise HTTPException(status_code=403, detail="object_key outside allowed prefixes")
    bucket = payload.get("bucket")
    file_id = str(payload.get("file_id") or f"obj-{abs(hash(object_key)) % 10**10}")
    course_id = str(payload.get("course_id") or "")

    storage = get_storage()
    if bucket and isinstance(storage, MinioStorage) and bucket != storage.bucket:
        storage = MinioStorage(bucket=bucket)
    data = storage.get_bytes(object_key)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Object not found: {object_key}")

    suffix = Path(object_key).suffix.lower()
    if suffix != ".pdf":
        raise HTTPException(status_code=415, detail=f"Unsupported object type: {suffix}")
    tmp_path = _save_to_temp(data, Path(object_key).name)
    try:
        bundle, legacy = await asyncio.to_thread(
            _run_full_analysis, tmp_path, file_id,
            filename=Path(object_key).name, course_id=course_id,
            job_id=str(payload.get("job_id") or f"obj-{file_id}"),
        )
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
    return {"engine": "layout", "bundle": bundle, "legacy": legacy}


# ---------------------------------------------------------------------------
# Pipeline Inspector artifact server
# ---------------------------------------------------------------------------

_ALLOWED_ID = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.")


def _safe_component(value: str) -> bool:
    return bool(value) and all(c in _ALLOWED_ID for c in value) and ".." not in value


@app.get("/inspect/documents")
def inspect_documents() -> dict:
    """List analyzed documents available in the local artifacts store."""
    from .layout.storage import artifacts_root

    root = artifacts_root()
    docs = []
    if root.exists():
        for entry in sorted(root.iterdir()):
            doc_json = entry / "document.json"
            if not entry.is_dir() or not doc_json.exists():
                continue
            try:
                meta = json.loads(doc_json.read_text(encoding="utf-8"))
                docs.append({
                    "file_id": entry.name,
                    "filename": meta.get("filename"),
                    "page_count": meta.get("page_count"),
                    "sha256": meta.get("sha256"),
                    "providers_used": meta.get("providers_used"),
                    "quality": {
                        k: (meta.get("quality") or {}).get(k)
                        for k in ("blocks_detected", "exercises_detected", "coverage", "pages_total")
                    },
                    "analyzed_at": doc_json.stat().st_mtime,
                })
            except Exception:  # noqa: BLE001
                continue
    return {"documents": docs}


@app.get("/inspect/documents/{doc_id}")
def inspect_document(doc_id: str) -> dict:
    """Return the full stored document.json bundle."""
    if not _safe_component(doc_id):
        raise HTTPException(status_code=400, detail="Invalid document id")
    from .layout.storage import artifacts_root

    path = artifacts_root() / doc_id / "document.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"No analysis stored for {doc_id}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Corrupt artifact: {exc}") from exc


@app.get("/inspect/documents/{doc_id}/pages/{page}/image.png")
def inspect_page_image(doc_id: str, page: int):
    if not _safe_component(doc_id) or page < 1 or page > 2000:
        raise HTTPException(status_code=400, detail="Invalid identifiers")
    from .layout.storage import artifacts_root

    path = artifacts_root() / doc_id / "pages" / f"page_{page:03d}.png"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Page render not found")
    return FileResponse(path, media_type="image/png")


@app.get("/inspect/documents/{doc_id}/blocks/{block_id}.png")
def inspect_block_image(doc_id: str, block_id: str):
    if not _safe_component(doc_id) or not _safe_component(block_id):
        raise HTTPException(status_code=400, detail="Invalid identifiers")
    from .layout.storage import artifacts_root

    path = artifacts_root() / doc_id / "blocks" / f"{block_id}.png"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Block crop not found")
    return FileResponse(path, media_type="image/png")


@app.get("/inspect/documents/{doc_id}/debug")
def inspect_debug(doc_id: str, layer: str | None = None):
    """Debug representation (spec 18): toggle each pipeline layer independently.

    Query ``?layer=raw|atomic|classified|resolved|semantic|evaluation`` returns
    only that layer; without ``layer`` returns all layers + evaluation.
    Layers are the authoritative per-page trace:

        raw_detector → atomic_elements → classified_elements → resolved_elements
        → semantic_groups → exercises

    Every layer preserves provenance and bbox so inspectors can overlay.
    """
    if not _safe_component(doc_id):
        raise HTTPException(status_code=400, detail="Invalid document id")
    from .layout.storage import artifacts_root

    path = artifacts_root() / doc_id / "document.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"No analysis stored for {doc_id}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Corrupt artifact: {exc}") from exc
    layers = data.get("debugLayers") or data.get("debug_layers") or {}
    evaluation = data.get("evaluation") or {}
    # Support both naming conventions (Python bundle uses camelCase via to_dict)
    all_layers = {
        "raw": layers.get("raw_detector") or layers.get("raw") or data.get("pages"),
        "atomic": layers.get("atomic_elements") or data.get("atomicElements") or [],
        "classified": layers.get("classified_elements"),
        "resolved": layers.get("resolved_elements"),
        "semantic": layers.get("semantic_groups") or data.get("semanticGroups") or [],
        "exercises": data.get("exercises") or [],
        "evaluation": evaluation,
        "quality": data.get("quality") or {},
        "telemetry": data.get("telemetry") or [],
    }
    if layer:
        if layer not in all_layers:
            raise HTTPException(status_code=400, detail=f"Unknown layer '{layer}'. Use one of {list(all_layers.keys())}")
        return {"doc_id": doc_id, "layer": layer, "data": all_layers[layer], "evaluation": evaluation}
    return {"doc_id": doc_id, "layers": all_layers, "evaluation": evaluation, "quality": data.get("quality"), "page_count": data.get("page_count")}


@app.post("/extract")
async def extract_full(
    file: UploadFile = File(...),
    engine: Literal["layout", "legacy_graph", "pipeline", "graph"] = Form("layout"),
    require_answer: bool = Form(False),
) -> dict:
    """Run extraction on an uploaded PDF.

    ``engine`` selects orchestration: ``layout`` (default) runs the
    deterministic layout-first LangGraph; ``legacy_graph``/``pipeline`` keep
    the pre-rebuild text-based graph for rollback comparisons.
    """
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 100 MB)")

    suffix = Path(file.filename or "file").suffix.lower()
    if suffix not in (".pdf", ".txt", ".md", ".docx", ".pptx"):
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {suffix or 'unknown'}")

    fd, tmp_path = tempfile.mkstemp(suffix=suffix or ".txt")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)

        if engine in ("layout", "graph"):
            fid = f"upload-{abs(hash(file.filename or 'pdf')) % 10**8}"
            bundle, legacy = await asyncio.to_thread(
                _run_full_analysis, tmp_path, fid,
                filename=file.filename, job_id=f"extract-{fid}",
                context={"require_answer": require_answer},
            )
            return {"engine": engine, "result": legacy, "bundle": bundle}

        if engine == "legacy_graph":
            from .graph import run_graph_extraction

            result = await asyncio.to_thread(run_graph_extraction, tmp_path, "upload")
        else:
            from .pipeline import run_pipeline

            result = await asyncio.to_thread(run_pipeline, tmp_path, "upload", require_answer=require_answer)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        if "Forced provider" in msg and ("not available" in msg or "missing" in msg):
            raise HTTPException(status_code=503, detail=msg) from exc
        logger.exception("Extraction failed")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {exc}") from exc
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    return {"engine": engine, "result": result}


@app.post("/extract/exercises")
async def extract_exercises_json(payload: dict) -> dict:
    """JSON endpoint for already-extracted text (Next.js transform worker).

    Body: ``{"files": [{"id": "asset-1", "name": "Kursbuch.pdf", "text": "..."}],
    "require_answer": false}``. Runs the re-done exercise extraction
    (LLM discovery + heuristic fallback, validated) per file and returns
    flashcard-ready exercises, preserving each file's asset id as ``source``.
    """
    files = payload.get("files") or []
    if not isinstance(files, list) or not files:
        raise HTTPException(status_code=400, detail="files array required")
    require_answer = bool(payload.get("require_answer"))

    from .exercises import extract_exercises

    results = []
    mode = "heuristic"
    for f in files:
        if not isinstance(f, dict):
            continue
        fid = str(f.get("id") or "")
        name = str(f.get("name") or "file")
        text = str(f.get("text") or "")
        if not text:
            continue
        res = await asyncio.to_thread(extract_exercises, name, text, require_answer=require_answer)
        flashcards = [
            {
                "id": f"{fid}-ex-{i}",
                "type": ex.get("type", "assessment"),
                "prompt": ex.get("prompt", ""),
                "answer": ex.get("answer"),
                "options": ex.get("options") or [],
                "page": ex.get("page"),
                "name": ex.get("name"),
                "source": fid,
            }
            for i, ex in enumerate(res["exercises"])
        ]
        if res["mode"] == "llm":
            mode = "llm"
        results.append(
            {
                "file_id": fid,
                "file_name": name,
                "mode": res["mode"],
                "flashcards": flashcards,
            }
        )

    return {
        "mode": mode,
        "files": results,
        "flashcards": [fc for r in results for fc in r["flashcards"]],
    }


def _merge_results(results: list[dict]) -> dict:
    """Merge per-file pipeline dicts into one package-wide graph result."""
    merged: dict = {}
    for key in (
        "classifications",
        "exercises",
        "flashcards",
        "questions",
        "answers",
        "relationships",
        "images",
        "audio",
        "layout_blocks",
        "chapters",
        "lessons",
        "topics",
        "grammar_rules",
        "vocabulary",
    ):
        merged[key] = [item for r in results for item in r.get(key, [])]

    merged["course"] = {}
    merged["knowledgeGraph"] = {
        "nodes": [n for r in results for n in r.get("knowledgeGraph", {}).get("nodes", [])],
        "links": [l for r in results for l in r.get("knowledgeGraph", {}).get("links", [])],
    }
    merged["quality"] = {
        "exercises_extracted": sum(
            len(r.get("exercises", [])) for r in results
        ),
        "orphan_audio": sum(r.get("quality", {}).get("orphan_audio", 0) for r in results),
        "orphan_video": sum(r.get("quality", {}).get("orphan_video", 0) for r in results),
        "duplicate_exercises": sum(
            r.get("quality", {}).get("duplicate_exercises", 0) for r in results
        ),
        "missing_solutions": sum(
            r.get("quality", {}).get("missing_solutions", 0) for r in results
        ),
        "issues": [i for r in results for i in r.get("quality", {}).get("issues", [])],
    }
    merged["minio"] = [r["minio"] for r in results if r.get("minio")]
    merged["ocr_used"] = any(r.get("ocr_used") for r in results)
    merged["ocr_engine"] = next(
        (r.get("ocr_engine", "pymupdf") for r in results if r.get("ocr_used")), "pymupdf"
    )
    merged["extraction_mode"] = next(
        (r.get("extraction_mode", "heuristic") for r in results if r.get("extraction_mode")),
        "heuristic",
    )
    # Phase 7/12/21: explicit statuses + telemetry never silently dropped.
    merged["needs_review"] = any(r.get("status") == "needs_review" for r in results)
    merged["file_reports"] = [
        {
            "file_id": (r.get("classifications") or [{}])[0].get("file_id"),
            "status": r.get("status"),
            "sha256": r.get("sha256"),
            "page_count": r.get("page_count"),
            "ocr_used": r.get("ocr_used"),
            "quality": {
                k: r.get("quality", {}).get(k)
                for k in (
                    "exercises_extracted", "coverage", "processed_pages", "total_pages",
                    "skipped_pages", "truncation", "orphan_media_count", "duplicate_candidates",
                    "capped", "issues",
                )
            },
        }
        for r in results
    ]
    try:
        from .llm import usage_snapshot

        merged["llm_usage"] = usage_snapshot()
    except Exception:  # noqa: BLE001
        pass
    return merged


@app.post("/extract/batch")
async def extract_batch(
    files: list[UploadFile] = File(...),
    engine: Literal["layout", "legacy_graph", "graph", "pipeline"] = Form("layout"),
    require_answer: bool = Form(False),
    prefix: str = Form("uploads"),
    course_id: str = Form(""),
    media_inventory: str = Form("[]"),
) -> dict:
    """Extract a whole package (Kursbuch + Übungsbuch + audio refs).

    Default ``layout`` engine: deterministic layout-first graph per file,
    cross-file relationships in ONE batch pass.
    """
    import json as _json

    from .assets import build_document_asset
    from .relationships import build_course_relationships

    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    try:
        inventory = _json.loads(media_inventory) if media_inventory else []
        if not isinstance(inventory, list):
            raise ValueError
    except ValueError:
        raise HTTPException(status_code=400, detail="media_inventory must be a JSON array")

    total = 0
    tmp_paths: list[str] = []
    assets = []
    try:
        for file in files:
            data = await file.read()
            total += len(data)
            if total > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="Batch too large (max 100 MB)")
            suffix = Path(file.filename or "file").suffix.lower()
            if suffix not in (".pdf", ".txt", ".md", ".docx", ".pptx"):
                raise HTTPException(status_code=415, detail=f"Unsupported file type: {suffix or 'unknown'}")
            fd, tmp_path = tempfile.mkstemp(suffix=suffix or ".txt")
            with os.fdopen(fd, "wb") as f:
                f.write(data)
            tmp_paths.append(tmp_path)
            assets.append((tmp_path, f"file-{len(assets)}", file.filename or f"file-{len(assets)}"))
    except HTTPException:
        _cleanup(tmp_paths)
        raise

    # Parse each document exactly once (original names preserved for
    # classification + chapter detection).
    parsed_assets = []
    try:
        for tmp_path, file_id, filename in assets:
            parsed_assets.append(
                build_document_asset(
                    tmp_path, file_id,
                    object_key=f"{prefix}/raw/{filename}",
                    filename=filename,
                )
            )
    finally:
        pass  # temp files still needed for OCR fallback path lookups

    context = {
        "require_answer": require_answer,
        "course_id": course_id,
        "media_inventory": inventory,
    }

    results: list[dict] = []
    summaries: list[dict] = []
    try:
        for asset in parsed_assets:
            path = next(p for p, fid, _n in assets if fid == asset.file_id)
            bundle, legacy = await asyncio.to_thread(
                _run_full_analysis,
                path,
                asset.file_id,
                filename=asset.filename,
                course_id=course_id,
                job_id=f"batch-{course_id or 'adhoc'}-{asset.sha256[:12]}",
                context=context,
            )
            results.append(legacy)
            summaries.append(asset.to_summary())

        # ONE batch-level relationship pass (never N² sibling re-parsing).
        rel = await asyncio.to_thread(build_course_relationships, results, summaries)
        for result in results:
            result["relationships"] = rel["links"]
        merged = _merge_results(results)
        merged["material_links"] = [
            {
                "from_exercise_id": r["from"],
                "to_exercise_id": r["to"],
                "relationship_type": r["relationship"],
                "confidence": r["confidence"],
                "rationale": r["rationale"],
                **({"needs_review": True} if r.get("needs_review") else {}),
            }
            for r in rel["relationships"]
            if str(r.get("from", "")).startswith("ex-") and str(r.get("to", "")).startswith("ex-")
        ]
        merged["minio"] = [
            {"object_key": a.object_key, "bucket": os.environ.get("MINIO_BUCKET", "woodpacker-files")}
            for a in parsed_assets if a.object_key and os.environ.get("MINIO_ENDPOINT")
        ]
        merged["ocr_used"] = any(r.get("ocr_used") for r in results)
        merged["ocr_engine"] = next(
            (r.get("ocr_engine", "pymupdf") for r in results if r.get("ocr_used")), "pymupdf"
        )
        merged["extraction_mode"] = next(
            (r.get("extraction_mode", "heuristic") for r in results if r.get("extraction_mode")),
            "heuristic",
        )
        merged["needs_review"] = any(r.get("status") == "needs_review" for r in results)
        return {"engine": engine, "files": len(results), "result": merged}
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Batch extraction failed")
        raise HTTPException(status_code=500, detail=f"Batch extraction failed: {exc}") from exc
    finally:
        _cleanup(tmp_paths)


def _cleanup(paths: list[str]) -> None:
    for p in paths:
        try:
            os.remove(p)
        except OSError:
            pass


@app.post("/extract/object")
async def extract_object(payload: dict) -> dict:
    """Queue-worker entry point (Phase 13/15): extract ONE stored object.

    Body: {"object_key": "...", "bucket"?: "...", "file_id"?: "...",
           "course_id"?: "...", "require_answer"?: bool,
           "media_inventory"?: [...], "job_id"?: "..."}

    The worker never ships file bodies — the extraction service streams the
    object from storage itself. Object keys must live under known prefixes.
    On success the extracted text JSON is mirrored to
    ``courses/{course_id}/text/{file_id}.json`` (best-effort).
    """
    import json as _json

    from .storage_backend import MinioStorage, course_key, get_storage, put_json, validate_readable_key

    object_key = str(payload.get("object_key") or "")
    if not object_key:
        raise HTTPException(status_code=400, detail="object_key required")
    if not validate_readable_key(object_key):
        raise HTTPException(status_code=403, detail="object_key outside allowed prefixes")

    bucket = payload.get("bucket")
    file_id = str(payload.get("file_id") or f"obj-{abs(hash(object_key)) % 10**10}")
    course_id = str(payload.get("course_id") or "")

    from .storage_backend import MinioStorage as _MinioStorage

    storage = get_storage()
    if bucket and isinstance(storage, _MinioStorage) and bucket != storage.bucket:
        storage = _MinioStorage(bucket=bucket)

    data = storage.get_bytes(object_key)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Object not found: {object_key}")

    suffix = Path(object_key).suffix.lower() or ".bin"
    if suffix not in (".pdf", ".txt", ".md", ".docx", ".pptx"):
        raise HTTPException(status_code=415, detail=f"Unsupported object type: {suffix}")

    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    bundle: dict | None = None
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        context = {
            "require_answer": bool(payload.get("require_answer")),
            "course_id": course_id,
            "media_inventory": payload.get("media_inventory") or [],
        }
        bundle, result = await asyncio.to_thread(
            _run_full_analysis,
            tmp_path,
            file_id,
            filename=Path(object_key).name,
            course_id=course_id,
            job_id=str(payload.get("job_id") or f"obj-{file_id}"),
            context=context,
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Object extraction failed for %s", object_key)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {exc}") from exc
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    # Best-effort text mirror for downstream stages (idempotent by file_id).
    if course_id and os.environ.get("MINIO_ENDPOINT"):
        try:
            pages_payload: list[dict] = []
            for page in (bundle or {}).get("pages", []):
                page_no = int(page.get("page", 0))
                text = "\n".join(
                    str(b.get("text") or "")
                    for b in page.get("blocks", [])
                    if b.get("text")
                )
                pages_payload.append({"page": page_no, "text": text})
            put_json(
                storage,
                course_key(course_id, "text", f"{file_id}.json"),
                {
                    "file_id": file_id,
                    "object_key": object_key,
                    "sha256": (bundle or {}).get("sha256", ""),
                    "page_count": (bundle or {}).get("page_count", 0),
                    "pages": pages_payload,
                    "status": result.get("status"),
                },
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Text mirror skipped for %s: %s", file_id, exc)

    return {"engine": "layout", "files": 1, "result": result}


def run() -> None:
    """Programmatic entry point: ``python -m woodpacker_extraction.server``."""
    import uvicorn

    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", 8001))
    print(f"[woodpacker-extraction] FastAPI on http://{host}:{port}", flush=True)
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    run()
