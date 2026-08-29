"""Stage 10: Storage — every detected object persisted as structured JSON.

Layout under ``ARTIFACTS_DIR`` (default ``<service>/.artifacts``):

    {file_id}/document.json          the full DocumentBundle
    {file_id}/pages/page_{n:03d}.png rendered page images
    {file_id}/blocks/{block_id}.png  cropped blocks

When MinIO is configured the bundle + assets are mirrored to
``courses/{course_id}/analysis/{file_id}/...`` (best-effort, never fatal).
All writes are idempotent: identical input overwrites identical bytes.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from .crops import crop_png_bytes, page_png_bytes
from .types import DocumentBundle

logger = logging.getLogger(__name__)


def artifacts_root() -> Path:
    root = os.environ.get("ARTIFACTS_DIR")
    if not root:
        root = Path(__file__).resolve().parent.parent.parent.parent / ".artifacts"
    return Path(root)


def store_bundle(
    bundle: DocumentBundle,
    *,
    page_images: dict[int, Any],
    crops: dict[str, Any],
    course_id: str = "",
) -> dict[str, Any]:
    """Write document.json + page renders + block crops. Returns artifact paths."""
    doc_dir = artifacts_root() / bundle.file_id
    pages_dir = doc_dir / "pages"
    blocks_dir = doc_dir / "blocks"
    for d in (pages_dir, blocks_dir):
        d.mkdir(parents=True, exist_ok=True)

    artifacts: dict[str, Any] = {
        "document_json": str(doc_dir / "document.json"),
        "pages": [],
        "blocks": [],
    }

    # 1. Page renders.
    for page in bundle.pages:
        img = page_images.get(page.page)
        if img is None:
            continue
        path = pages_dir / f"page_{page.page:03d}.png"
        path.write_bytes(page_png_bytes(img))
        artifacts["pages"].append({"page": page.page, "path": str(path)})

    # 2. Block crops (every block, spec Stage 3).
    for block in bundle.all_blocks():
        crop = crops.get(block.block_id)
        if crop is None:
            continue
        path = blocks_dir / f"{block.block_id}.png"
        path.write_bytes(crop_png_bytes(crop))
        artifacts["blocks"].append({"block_id": block.block_id, "path": str(path)})

    # 3. Bundle JSON (sorted keys => deterministic bytes).
    bundle.artifacts = {
        "local_root": str(doc_dir),
        "pages": [p["path"] for p in artifacts["pages"]],
        "blocks": [b["path"] for b in artifacts["blocks"]],
    }
    (doc_dir / "document.json").write_text(
        json.dumps(bundle.to_dict(), ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )

    # 4. Best-effort MinIO mirror.
    if os.environ.get("MINIO_ENDPOINT"):
        _mirror_to_storage(bundle, doc_dir, course_id)

    return artifacts


def _mirror_to_storage(bundle: DocumentBundle, doc_dir: Path, course_id: str) -> None:
    try:
        from ..storage_backend import get_storage

        storage = get_storage()
        prefix = f"courses/{course_id or 'adhoc'}/analysis/{bundle.file_id}"
        payload = (doc_dir / "document.json").read_bytes()
        storage.put_bytes(f"{prefix}/document.json", payload, content_type="application/json")
        for png in sorted(doc_dir.glob("blocks/*.png")):
            storage.put_bytes(f"{prefix}/blocks/{png.name}", png.read_bytes(), content_type="image/png")
        for png in sorted(doc_dir.glob("pages/*.png")):
            storage.put_bytes(f"{prefix}/pages/{png.name}", png.read_bytes(), content_type="image/png")
        logger.info("Mirrored analysis artifacts to %s/", prefix)
    except Exception as exc:  # noqa: BLE001
        logger.warning("MinIO mirror skipped for %s: %s", bundle.file_id, exc)
