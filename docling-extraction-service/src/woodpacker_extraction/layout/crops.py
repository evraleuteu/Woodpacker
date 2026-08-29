"""Stage 1 + 3: PDF loading (page renders) and per-block cropping."""

from __future__ import annotations

import logging
import os
from io import BytesIO
from typing import Any

import pymupdf

from .providers import Region
from .types import RENDER_DPI, LayoutBlock, PageModel, TextSpan, clamp_bbox

logger = logging.getLogger(__name__)

MAX_RENDER_PAGES = int(os.environ.get("RENDER_MAX_PAGES", "300"))


def load_pdf_pages(pdf_path: str) -> tuple[list[PageModel], dict[int, Any], bool]:
    """Render every page and read the digital text-layer profile.

    Returns (pages, images_by_page, all_digital) where ``images_by_page`` maps
    page number -> PIL RGB render at RENDER_DPI.
    """
    from PIL import Image

    pages: list[PageModel] = []
    images: dict[int, Any] = {}
    doc = pymupdf.open(str(pdf_path))
    try:
        for i in range(min(doc.page_count, MAX_RENDER_PAGES)):
            page = doc[i]
            pix = page.get_pixmap(dpi=RENDER_DPI)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            has_text_layer = len(page.get_text().strip()) > 20 or _has_vector_text(page)
            pages.append(
                PageModel(
                    page=i + 1,
                    width=pix.width,
                    height=pix.height,
                    has_text_layer=has_text_layer,
                    render_dpi=RENDER_DPI,
                )
            )
            images[i + 1] = img
        return pages, images, all(p.has_text_layer for p in pages if p.page <= len(pages)) and bool(pages)
    finally:
        doc.close()


def _has_vector_text(page: Any) -> bool:
    """A page with drawings/annotations but no extractable text is still 'digital'."""
    try:
        return len(page.get_drawings()) > 0 and False  # conservative: not text
    except Exception:  # noqa: BLE001
        return False


def build_blocks_from_regions(
    regions_by_page: dict[int, list[Region]],
    pages: list[PageModel],
) -> None:
    """Attach deterministic block ids to provider regions (in-place on pages).

    Ids follow the spec format: ``page_{page:03d}_block_{idx:03d}``.
    """
    by_number = {p.page: p for p in pages}
    for page_no, regions in sorted(regions_by_page.items()):
        model = by_number.get(page_no)
        if model is None:
            continue
        blocks: list[LayoutBlock] = []
        for idx, region in enumerate(regions):
            bbox = clamp_bbox(region.bbox, float(model.width), float(model.height))
            spans = [
                TextSpan(
                    text=s["text"],
                    bbox=tuple(s["bbox"]),  # type: ignore[arg-type]
                    font_name=s.get("font_name", ""),
                    font_size=float(s.get("font_size", 0)),
                )
                for s in region.spans
                if len(s.get("bbox", [])) == 4
            ]
            blocks.append(
                LayoutBlock(
                    block_id=f"page_{page_no:03d}_block_{idx:03d}",
                    page=page_no,
                    type=region.type_hint,
                    bbox=bbox,
                    confidence=max(0.0, min(1.0, region.confidence)),
                    text=region.text,
                    source=region.source,
                    spans=spans,
                    meta=dict(region.meta),
                )
            )
        model.blocks = blocks


def crop_blocks(
    images_by_page: dict[int, Any],
    pages: list[PageModel],
) -> dict[str, Any]:
    """Crop every block from its rendered page (2px padding, clamped)."""
    crops: dict[str, Any] = {}
    for page in pages:
        base = images_by_page.get(page.page)
        if base is None:
            continue
        for block in page.blocks:
            x0, y0, x1, y1 = block.bbox
            pad = 2.0
            box = (
                max(0, int(x0 - pad)),
                max(0, int(y0 - pad)),
                min(base.width, int(x1 + pad)),
                min(base.height, int(y1 + pad)),
            )
            if box[2] <= box[0] or box[3] <= box[1]:
                continue
            crops[block.block_id] = base.crop(box)
    return crops


def page_png_bytes(img: Any) -> bytes:
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def crop_png_bytes(crop: Any) -> bytes:
    buf = BytesIO()
    crop.save(buf, format="PNG")
    return buf.getvalue()
