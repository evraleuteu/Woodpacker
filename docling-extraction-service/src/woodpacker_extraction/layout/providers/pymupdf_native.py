"""Deterministic PyMuPDF-native layout provider (digital PDFs).

Uses the PDF's own text layer + object model — the most deterministic and
exact source of layout for digital pages:

* text blocks with per-span fonts/sizes  -> title/subtitle/paragraph/question/...
* ``page.find_tables()``                 -> table
* image rects                            -> image

All coordinates are converted from PDF points to render-pixel space
(``scale = RENDER_DPI / 72``) so they align with stored page images.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from ..types import RENDER_DPI, BBox, bbox_area, bbox_intersection, clamp_bbox
from . import Region

logger = logging.getLogger(__name__)

PAGE_NUMBER_RE = re.compile(r"^[-–—\s]*(\d{1,3})[-–—\s]*$")
CAPTION_RE = re.compile(r"^\s*(abb\.|abbildung|bild|fig\.|figure|foto|picture|grafik|table|tabelle)\s*\d*", re.IGNORECASE)
AUDIO_REF_RE = re.compile(r"\b(cd|hörtext|hoertext|track|spur|audio)\s*\d+", re.IGNORECASE)
VIDEO_REF_RE = re.compile(r"\b(video|film|ausschnitt)\s*\d+", re.IGNORECASE)

_HEADER_BAND = 0.07   # top 7% of page height
_FOOTER_BAND = 0.07   # bottom 7%


def _to_px(bbox_pts: Any, scale: float, width: float, height: float) -> BBox:
    raw = (
        float(bbox_pts[0]) * scale,
        float(bbox_pts[1]) * scale,
        float(bbox_pts[2]) * scale,
        float(bbox_pts[3]) * scale,
    )
    return clamp_bbox(raw, width, height)


class PyMuPDFProvider:
    name = "pymupdf"

    def available(self) -> bool:
        try:
            import pymupdf  # noqa: F401

            return True
        except Exception:  # noqa: BLE001
            return False

    def detect_page(
        self,
        page_image: Any,
        page_number: int,
        pdf_page: Any | None = None,
    ) -> list[Region]:
        if pdf_page is None:
            return []
        scale = RENDER_DPI / 72.0
        width = page_image.width
        height = page_image.height
        regions: list[Region] = []

        # --- Tables first (their text is excluded below by bbox overlap). ---
        table_boxes: list[BBox] = []
        try:
            finder = pdf_page.find_tables()
            for tab in finder.tables:
                tb = _to_px(tab.bbox, scale, width, height)
                if bbox_area(tb) >= 400:
                    table_boxes.append(tb)
                    regions.append(Region(bbox=tb, type_hint="table", confidence=0.9, source=self.name))
        except Exception as exc:  # noqa: BLE001
            logger.debug("find_tables failed on page %s: %s", page_number, exc)

        # --- Body font size (char-weighted mode proxy: median of sizes). ---
        sizes: list[float] = []
        text_dict = pdf_page.get_text("dict")
        for block in text_dict.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    txt = (span.get("text") or "").strip()
                    if txt:
                        sizes.append(float(span.get("size", 0) or 0))
        body_size = _median(sizes) if sizes else 11.0

        def inside_any(bb: BBox, boxes: list[BBox]) -> bool:
            cx = (bb[0] + bb[2]) / 2
            cy = (bb[1] + bb[3]) / 2
            return any(x0 <= cx <= x1 and y0 <= cy <= y1 for x0, y0, x1, y1 in boxes)

        # --- Text blocks (with per-line bbox so frontend can hover line-by-line). ---
        for block in text_dict.get("blocks", []):
            if block.get("type") != 0:
                continue
            spans_out: list[dict[str, Any]] = []
            parts: list[str] = []
            lines_meta: list[dict[str, Any]] = []
            max_font = 0.0
            for line in block.get("lines", []):
                line_parts: list[str] = []
                line_span_indices: list[int] = []
                line_bboxes: list[BBox] = []
                for span in line.get("spans", []):
                    txt = span.get("text") or ""
                    if not txt.strip():
                        continue
                    sb = _to_px(span["bbox"], scale, width, height)
                    font_name = str(span.get("font", ""))
                    font_size = float(span.get("size", 0) or 0)
                    max_font = max(max_font, font_size)
                    idx = len(spans_out)
                    spans_out.append(
                        {"text": txt, "bbox": [round(v, 2) for v in sb], "font_name": font_name, "font_size": round(font_size, 2)}
                    )
                    line_parts.append(txt)
                    line_span_indices.append(idx)
                    line_bboxes.append(sb)
                line_text = "".join(line_parts).strip()
                if line_text and line_bboxes:
                    # union of span bboxes = tight line bbox
                    lx0 = min(b[0] for b in line_bboxes)
                    ly0 = min(b[1] for b in line_bboxes)
                    lx1 = max(b[2] for b in line_bboxes)
                    ly1 = max(b[3] for b in line_bboxes)
                    line_bbox = clamp_bbox((lx0, ly0, lx1, ly1), width, height)
                    lines_meta.append({
                        "bbox": [round(v, 2) for v in line_bbox],
                        "text": line_text[:300],
                        "span_indices": line_span_indices,
                    })
                # Preserve blank lines as paragraph breaks (empty part).
                if line_parts or not parts:
                    parts.append("".join(line_parts))
            text = "\n".join(parts).strip()
            if not text or not spans_out:
                continue
            bbox = _to_px(block["bbox"], scale, width, height)
            regions.append(
                Region(
                    bbox=bbox,
                    type_hint=_classify_text_block(
                        text=text,
                        bbox=bbox,
                        page_height=height,
                        max_font=max_font,
                        body_size=body_size,
                        in_table=inside_any(bbox, table_boxes),
                    ),
                    confidence=0.98,
                    source=self.name,
                    text=text,
                    spans=spans_out,
                    meta={"lines": lines_meta},
                )
            )

        # --- Images + icons: every raster image becomes a hoverable block.
        # Icons are tiny (<0.8% page) but remain inspectable per the
        # line/image/icon hover requirement; they're kept with a lower
        # confidence so the knowledge graph can filter them if desired.
        page_area = max(1.0, float(width) * float(height))
        seen_xrefs: set[int] = set()
        for img in pdf_page.get_images(full=True):
            xref = int(img[0])
            if xref in seen_xrefs:
                continue
            seen_xrefs.add(xref)
            try:
                rects = pdf_page.get_image_rects(xref)
            except Exception:  # noqa: BLE001
                rects = []
            for r in rects[:4]:
                if r.x1 <= r.x0 or r.y1 <= r.y0:
                    continue
                ib = _to_px((r.x0, r.y0, r.x1, r.y1), scale, width, height)
                area_ratio = bbox_area(ib) / page_area
                if bbox_area(ib) < 64:  # 8×8px noise
                    continue
                # Keep icons (0.02%–0.8%) with slightly lower confidence;
                # larger illustrations/photos retain 0.95.
                is_icon = area_ratio < 0.008
                regions.append(Region(
                    bbox=ib,
                    type_hint="image",
                    confidence=0.88 if is_icon else 0.95,
                    source=self.name,
                    meta={"icon": is_icon, "area_ratio": round(area_ratio, 4)},
                ))

        # --- Vector icons / small drawings: hoverable icon-by-icon ---
        # Textbook speaker/volume/bullet icons are often vector paths, not
        # raster images. Keep small square-ish filled drawings as icons so
        # they are individually hoverable even when they never appear in
        # get_images(). De-duplicate against raster image bboxes.
        try:
            drawings = pdf_page.get_drawings() or []
            image_bboxes = [r.bbox for r in regions if r.type_hint == "image"]
            for d in drawings:
                rect = d.get("rect")
                if rect is None:
                    continue
                try:
                    x0, y0, x1, y1 = float(rect.x0), float(rect.y0), float(rect.x1), float(rect.y1)
                except Exception:  # noqa: BLE001
                    continue
                if x1 <= x0 or y1 <= y0:
                    continue
                db = _to_px((x0, y0, x1, y1), scale, width, height)
                area = bbox_area(db)
                if area < 64 or area / page_area > 0.008:
                    continue
                # Roughly square-ish icons (exclude long table borders).
                w, h = db[2] - db[0], db[3] - db[1]
                if max(w, h) / max(1.0, min(w, h)) > 2.8:
                    continue
                # Skip if overlapping an already-detected raster image.
                if any(bbox_intersection(db, ib) / max(area, 1.0) > 0.5 for ib in image_bboxes):
                    continue
                # Only filled shapes (icon glyphs have fill, table grid has stroke-only)
                if not d.get("fill"):
                    continue
                regions.append(Region(
                    bbox=db,
                    type_hint="image",
                    confidence=0.82,
                    source=self.name,
                    meta={"icon": True, "area_ratio": round(area / page_area, 4), "vector_icon": True},
                ))
        except Exception:  # noqa: BLE001
            pass

        return regions


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / 2


def _classify_text_block(
    *,
    text: str,
    bbox: BBox,
    page_height: float,
    max_font: float,
    body_size: float,
    in_table: bool,
) -> str:
    """Geometry+typography hint; semantic refinement happens in classify.py."""
    if in_table:
        return "table"
    first_line = text.split("\n", 1)[0].strip()
    rel_y_top = bbox[1] / max(page_height, 1.0)
    rel_y_bottom = bbox[3] / max(page_height, 1.0)

    if PAGE_NUMBER_RE.match(first_line) and len(text) <= 8 and rel_y_bottom >= 1 - _FOOTER_BAND:
        return "page_number"
    if rel_y_top <= _HEADER_BAND and len(text) < 120:
        return "header"
    if rel_y_top >= 1 - _FOOTER_BAND and len(text) < 120:
        return "footer"
    if CAPTION_RE.match(first_line):
        return "caption"
    ratio = (max_font or body_size) / max(body_size, 1.0)
    single_short = "\n" not in text and len(first_line) <= 90
    if ratio >= 1.6 and single_short:
        return "title"
    if ratio >= 1.25 and single_short:
        return "subtitle"
    short = len(text) < 120 and text.count("\n") <= 1
    if short and VIDEO_REF_RE.search(text):
        return "video_reference"
    if short and AUDIO_REF_RE.search(text):
        return "audio_reference"
    return "paragraph"
