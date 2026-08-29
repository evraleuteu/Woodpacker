"""DocumentAsset: parse each file exactly ONCE per extraction job.

This intermediate representation is the unit passed through LangGraph state.
A batch of N PDFs means exactly N parses — sibling files are never re-parsed
(Phase 6), and no document is ever silently truncated (Phase 7): every safety
boundary that fires is recorded in ``metadata.truncation`` and surfaces as
``needs_review`` downstream.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .extractor import (
    LayoutBlock,
    ExtractedImage,
    detect_kind,
    extract_images,
    extract_layout,
    extract_text,
    scan_profile,
)

logger = logging.getLogger(__name__)

# Hard safety boundary. Documents beyond this are processed up to the cap and
# the remainder is EXPLICITLY reported as skipped (never silently dropped).
MAX_PAGES_HARD = 1000


@dataclass
class DocumentAsset:
    """Parsed, content-addressed representation of one uploaded file."""

    file_id: str
    object_key: str | None
    filename: str
    mime_type: str
    kind: str                      # pdf | text | audio | video | image | other
    sha256: str
    page_count: int = 0
    pages: list[tuple[int, str]] = field(default_factory=list)   # (page_no, text)
    text: str = ""
    layout_blocks: list[LayoutBlock] = field(default_factory=list)
    images: list[ExtractedImage] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_summary(self) -> dict[str, Any]:
        """Lightweight projection for cross-file context (no heavy payloads)."""
        return {
            "file_id": self.file_id,
            "filename": self.filename,
            "kind": self.kind,
            "sha256": self.sha256,
            "page_count": self.page_count,
            "is_scanned": self.metadata.get("is_scanned", False),
            "material_type": self.metadata.get("material_type"),
        }


def sha256_file(path: str, chunk_size: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(chunk_size):
            h.update(chunk)
    return h.hexdigest()


def build_document_asset(
    path: str,
    file_id: str,
    *,
    object_key: str | None = None,
    filename: str | None = None,
    include_layout: bool = True,
    include_images: bool = True,
) -> DocumentAsset:
    """Parse a file into a DocumentAsset exactly once.

    ``filename`` overrides the on-disk name — callers processing temp copies
    MUST pass the original/object name so classification and chapter
    detection see the real identity.
    """
    p = Path(path)
    display_name = filename or p.name
    kind = detect_kind(display_name)
    mime_map = {
        "pdf": "application/pdf", "text": "text/plain", "audio": "audio/mpeg",
        "video": "video/mp4", "image": "image/png", "other": "application/octet-stream",
    }

    asset = DocumentAsset(
        file_id=file_id,
        object_key=object_key,
        filename=display_name,
        mime_type=mime_map.get(kind, "application/octet-stream"),
        kind=kind if kind != "text" and p.suffix.lower() in (".txt", ".md") else kind,
        sha256=sha256_file(path),
    )
    asset.kind = "pdf" if p.suffix.lower() == ".pdf" else ("text" if kind in ("text",) else kind)

    truncation: dict[str, Any] | None = None

    if asset.kind == "pdf":
        profile = scan_profile(path)
        asset.metadata["scan"] = profile
        asset.metadata["is_scanned"] = profile["is_scanned"]

        # Full-document text extraction with explicit truncation accounting.
        import pymupdf

        doc = pymupdf.open(str(p))
        try:
            total_pages = doc.page_count
            processed = min(total_pages, MAX_PAGES_HARD)
            pages: list[tuple[int, str]] = []
            for i in range(processed):
                page_text = doc[i].get_text()
                if page_text.strip():
                    pages.append((i + 1, page_text))
            if total_pages > MAX_PAGES_HARD:
                truncation = {
                    "reason": "page_cap",
                    "processed_pages": processed,
                    "total_pages": total_pages,
                    "skipped_pages": list(range(processed + 1, total_pages + 1)),
                }
                logger.warning(
                    "Document %s exceeds hard page cap (%d > %d); %d pages skipped EXPLICITLY",
                    p.name, total_pages, MAX_PAGES_HARD, total_pages - processed,
                )
        finally:
            doc.close()

        asset.page_count = profile["page_count"]
        asset.pages = pages
        asset.text = "\n".join(f"[PAGE {n}]\n{t.strip()}" for n, t in pages)

        if include_layout:
            try:
                asset.layout_blocks = extract_layout(path)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Layout extraction failed for %s: %s", p.name, exc)
        if include_images:
            try:
                asset.images = extract_images(path, file_id)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Image extraction failed for %s: %s", p.name, exc)

    elif asset.kind == "text":
        raw, _ = extract_text(str(p))
        asset.text = raw
        asset.metadata["is_scanned"] = False

    asset.metadata["truncation"] = truncation
    asset.metadata["ocr_used"] = False
    asset.metadata["ocr_engine"] = "pymupdf"
    return asset


def apply_ocr_to_asset(asset: DocumentAsset, ocr_text: str, engine: str) -> None:
    """Merge OCR output into an asset (only textless pages were OCR'd)."""
    if ocr_text and len(ocr_text.strip()) > len(asset.text):
        asset.text = ocr_text
        import re
        from .extractor import PDF_PAGE_RE

        pages: list[tuple[int, str]] = []
        matches = list(PDF_PAGE_RE.finditer(ocr_text))
        for i, m in enumerate(matches):
            start = m.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(ocr_text)
            body = ocr_text[start:end]
            if body.strip():
                pages.append((int(m.group(1)), body))
        asset.pages = pages
        asset.metadata["ocr_used"] = True
        asset.metadata["ocr_engine"] = engine


__all__ = ["DocumentAsset", "build_document_asset", "apply_ocr_to_asset", "sha256_file", "MAX_PAGES_HARD"]
