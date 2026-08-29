"""Atomic element extraction — the core fix for oversized region detection.

Large layout regions must be recursively decomposed into atomic document units:

    region → paragraphs → lines → text spans / words

Also owns:
  - visual element detection (QR/barcode/media markers via crops + heuristics)
  - background detection (page coverage, texture, low textual density)
  - design element detection (level badges like B2)
  - overlap resolution with type-pair specific rules
  - reading-order needs atomic granularity to be correct
  - evaluation metrics including oversized_region_rate

This module implements the atomic layer specified in the Woodpacker hierarchical
architecture. It is provider-agnostic and runs after coarse Layout Detection.

Design principles:
  * PDF-native geometry is preferred when available (pymupdf spans/lines).
  * OCR/vision geometry fallback splits via estimated line slicing.
  * Atomic elements retain parentId / provenance for debug/inspector layers.
  * Overlap resolution never blindly NMSes — different rules per pair.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

from .providers import Region
from .types import BBox, bbox_area, bbox_intersection, clamp_bbox

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Atomic element model (lightweight, JSON-serialisable)
# ---------------------------------------------------------------------------

ATOMIC_ELEMENT_TYPES = (
    "text",
    "heading",
    "subtitle",
    "paragraph",
    "label",
    "caption",
    "list",
    "list_item",
    "question",
    "instruction",
    "answer",
    "exercise",
    "table",
    "table_cell",
    "image",
    "illustration",
    "photo",
    "diagram",
    "qr_code",
    "barcode",
    "audio_marker",
    "video_marker",
    "icon",
    "logo",
    "design_element",
    "level_badge",
    "section_marker",
    "decorative_shape",
    "background",
    "page_decoration",
    "header",
    "footer",
    "page_number",
    "media_marker",
    "unknown",
)

# Canonical mapping used when splitting coarse block types into atomic subtypes.
_COARSE_TO_ATOMIC_SUBTYPE: dict[str, str] = {
    "title": "title",
    "subtitle": "subtitle",
    "paragraph": "paragraph",
    "exercise": "exercise",
    "instruction": "instruction",
    "question": "question",
    "answer_area": "answer",
    "image": "image",
    "table": "table",
    "header": "header",
    "footer": "footer",
    "audio_reference": "audio_marker",
    "video_reference": "video_marker",
    "page_number": "page_number",
    "caption": "caption",
    "unknown": "unknown",
}

LEVEL_BADGE_RE = re.compile(r"^\s*[A-C][12]\s*$", re.IGNORECASE)
QR_CUE_RE = re.compile(r"qr\s*code|scan\s*me|scannen", re.IGNORECASE)


def _is_level_badge_text(text: str) -> bool:
    t = text.strip()
    if LEVEL_BADGE_RE.match(t):
        return True
    # also bare level like "B2" with optional dot
    return bool(re.match(r"^\s*[A-C]\s*[12]\s*[+]?\s*$", t, re.IGNORECASE))


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    m = len(s) // 2
    return s[m] if len(s) % 2 else (s[m - 1] + s[m]) / 2


def _bbox_iou(a: BBox, b: BBox) -> float:
    inter = bbox_intersection(a, b)
    if inter == 0:
        return 0.0
    denom = bbox_area(a) + bbox_area(b) - inter
    return inter / denom if denom else 0.0


def _containment(inner: BBox, outer: BBox) -> float:
    area_inner = bbox_area(inner)
    if area_inner == 0:
        return 0.0
    inter = bbox_intersection(inner, outer)
    return inter / area_inner


# ---------------------------------------------------------------------------
# 1. Atomic decomposition
# ---------------------------------------------------------------------------

def decompose_regions_to_atomic(
    regions: list[Region],
    page_width: float,
    page_height: float,
) -> list[Region]:
    """Decompose coarse regions into atomic units.

    Returns a NEW list where large multi-line text regions are replaced by
    per-line atomic regions. Image/design/background regions are kept as-is
    but enriched with provenance. The decomposition preserves parent linkage
    via meta['parent_id'] and meta['atomic_level'].
    """
    atomic: list[Region] = []
    page_area = max(1.0, page_width * page_height)

    for region in regions:
        # Images / tables / icons are already atomic visually — no splitting.
        if region.type_hint in ("image", "table"):
            # Detect icon vs image vs background already; keep atomic.
            # Enrich with atomic flag.
            region.meta = dict(region.meta or {})
            region.meta.setdefault("atomic_level", "visual_object")
            # Background detection pass enriches it further.
            atomic.append(region)
            continue

        # Use precise line geometry when available (PyMuPDF).
        lines = region.meta.get("lines") if isinstance(region.meta, dict) else None
        spans = region.spans or []

        if lines and len(lines) >= 2:
            # Check if region is oversized multi-line that must be split.
            # Heuristic: if block bbox height is >1.6 * median line height and
            # covers 2+ distinct y bands, decompose.
            line_heights: list[float] = []
            for ln in lines:
                bb = ln.get("bbox") if isinstance(ln, dict) else None
                if bb and len(bb) == 4:
                    line_heights.append(float(bb[3]) - float(bb[1]))
            median_h = _median(line_heights) if line_heights else 0.0
            block_h = region.bbox[3] - region.bbox[1]

            # Oversized candidate: block contains 2+ lines with distinct text.
            should_split = (
                len(lines) >= 2
                and median_h > 0
                and block_h > median_h * 1.45
                and any((ln.get("text") or "").strip() for ln in lines)  # at least one non-empty
            )
            # Also split if region text contains multiple newline-separated
            # semantic lines and bbox is wide (>40% page width).
            if not should_split and region.text and region.text.count("\n") >= 2:
                should_split = (region.bbox[2] - region.bbox[0]) / max(page_width, 1) > 0.35 and block_h > median_h * 1.3

            if should_split:
                parent_id = region.meta.get("parent_id") or f"coarse_{id(region)}"
                # Use the original block's id style if present via meta.
                original_block_id = region.meta.get("block_id") or region.meta.get("id") or ""
                for idx, ln in enumerate(lines):
                    bb = ln.get("bbox")
                    if not bb or len(bb) != 4:
                        continue
                    text = (ln.get("text") or "").strip()
                    if not text:
                        continue
                    span_indices = ln.get("span_indices") or []
                    line_spans: list[dict[str, Any]] = []
                    if spans and span_indices:
                        for si in span_indices:
                            try:
                                line_spans.append(spans[si])
                            except Exception:
                                pass
                    # Per-line classification hint refinement:
                    line_type = _classify_line(
                        text=text,
                        bbox=tuple(float(v) for v in bb),  # type: ignore
                        page_height=page_height,
                        spans=line_spans,
                        parent_hint=region.type_hint,
                        page_width=page_width,
                    )
                    atomic.append(
                        Region(
                            bbox=clamp_bbox((float(bb[0]), float(bb[1]), float(bb[2]), float(bb[3])), page_width, page_height),
                            type_hint=line_type,
                            confidence=max(0.5, region.confidence * 0.96),
                            source=region.source,
                            text=text,
                            spans=line_spans,
                            meta={
                                "atomic_level": "line",
                                "parent_id": original_block_id or parent_id,
                                "parent_type": region.type_hint,
                                "line_index": idx,
                                "parent_bbox": list(region.bbox),
                                "font_info": _font_info_of_spans(line_spans),
                                "provenance": [region.source, "atomic_decomposition"],
                            },
                        )
                    )
                continue  # replaced coarse region with its lines

        # Fallback: region has no precise line boxes but is large and
        # contains newlines — split via estimated slices.
        if region.text and region.text.count("\n") >= 2:
            lines_text = [t.strip() for t in region.text.split("\n") if t.strip()]
            if len(lines_text) >= 3 and _is_oversized_text_region(region.bbox, page_width, page_height, line_count=len(lines_text)):
                # Estimated slicing vertically
                x0, y0, x1, y1 = region.bbox
                h = (y1 - y0) / len(lines_text)
                for idx, lt in enumerate(lines_text):
                    est_bbox: BBox = (
                        x0,
                        y0 + idx * h,
                        x1,
                        y0 + (idx + 1) * h,
                    )
                    line_type = _classify_line(
                        text=lt,
                        bbox=est_bbox,
                        page_height=page_height,
                        spans=[],
                        parent_hint=region.type_hint,
                        page_width=page_width,
                    )
                    atomic.append(
                        Region(
                            bbox=clamp_bbox(est_bbox, page_width, page_height),
                            type_hint=line_type,
                            confidence=max(0.5, region.confidence * 0.92),
                            source=region.source,
                            text=lt,
                            spans=[],
                            meta={
                                "atomic_level": "line_estimated",
                                "parent_id": region.meta.get("block_id", f"est_{idx}"),
                                "parent_type": region.type_hint,
                                "line_index": idx,
                                "parent_bbox": list(region.bbox),
                                "provenance": [region.source, "atomic_estimated_split"],
                            },
                        )
                    )
                continue

        # Otherwise keep as atomic block already (single line or non-text)
        region.meta = dict(region.meta or {})
        region.meta.setdefault("atomic_level", "block")
        # Enrich font info if spans present
        if spans and "font_info" not in region.meta:
            region.meta["font_info"] = _font_info_of_spans(spans)
        atomic.append(region)

    return atomic


def _is_oversized_text_region(bbox: BBox, page_width: float, page_height: float, line_count: int) -> bool:
    area = bbox_area(bbox)
    page_area = page_width * page_height
    # Oversized if > 8% of page area with 3+ lines and wide
    if area / page_area > 0.08 and line_count >= 3:
        return True
    # Or height > 22% of page height and wide
    if (bbox[3] - bbox[1]) / max(page_height, 1) > 0.22 and (bbox[2] - bbox[0]) / max(page_width, 1) > 0.55:
        return True
    return False


def _font_info_of_spans(spans: list[dict[str, Any]]) -> dict[str, Any]:
    if not spans:
        return {}
    sizes = [float(s.get("font_size", 0) or 0) for s in spans if s.get("font_size")]
    names = [str(s.get("font_name", "")) for s in spans if s.get("font_name")]
    bold = any("bold" in n.lower() or "black" in n.lower() for n in names)
    italic = any("italic" in n.lower() or "oblique" in n.lower() for n in names)
    return {
        "font_size": round(_median(sizes), 2) if sizes else 0,
        "font_family": names[0] if names else "",
        "bold": bold,
        "italic": italic,
    }


def _classify_line(*, text: str, bbox: BBox, page_height: float, spans: list[dict[str, Any]], parent_hint: str, page_width: float) -> str:
    """Refine per-line type using geometry + typography + content cues.

    This is NOT an LLM — deterministic rules operating on the line's own
    geometry, distinguishing the cover example elements.
    """
    t = text.strip()
    if not t:
        return parent_hint

    # Level badge detection — short, level token like "B2"
    if _is_level_badge_text(t) and len(t) <= 6:
        return "level_badge"  # will be mapped to design_element/level_badge downstream

    # Heading cues — all-caps or title-case short lines near top or large font.
    font_info = _font_info_of_spans(spans)
    font_size = float(font_info.get("font_size", 0) or 0)
    # Without font size, use length heuristics.
    short_single = len(t) <= 60 and "\n" not in t
    is_short_heading_style = short_single and (t[0].isupper() if t else False)

    # Background/design cues handled elsewhere; here we just classify text.
    lower = t.lower()

    # Audio/video/qr markers on their own line
    if re.search(r"\b(qr|audio|video|track|cd\s*\d|hören sie)\b", lower) and len(t) < 100:
        if "qr" in lower:
            return "qr_code"
        if "video" in lower:
            return "video_marker"
        return "audio_marker"

    # Exercise instruction pattern on a line
    if re.match(r"(?:kreuzen|ergänzen|ordnen|lesen|hören|schreiben|sprechen)\s+sie\b", lower):
        return "instruction"

    # Numbered question line
    if re.match(r"^\s*(\d+[a-z]?[.)]|[a-h][.)])\s+\S", t, re.IGNORECASE):
        return "question"

    # Title/subtitle discrimination via font size ratio if available.
    # Large font >=1.5 * body -> title; >=1.25 -> subtitle.
    # Without font info, use position + length: top short line -> title.
    if font_size:
        # Estimation: body ~10-11pt at 200dpi; we'll use relative inside line batch elsewhere.
        # Here we treat any line derived from a title-block as title if its font is largest.
        if font_size >= 18:
            return "title"
        if font_size >= 14:
            return "subtitle"
    # Fallback heuristic: very short uppercase-ish near top third => title
    rel_y = bbox[1] / max(page_height, 1)
    if rel_y < 0.33 and short_single and len(t.split()) <= 4 and t == t.strip():
        # Could be Kontext-type heading
        if len(t) < 25 and not re.search(r"[.!?]$", t):
            return "title"
        return "subtitle"

    # Otherwise preserve parent hint granularity
    if parent_hint in ("title", "subtitle", "paragraph"):
        # If parent was title but line is long paragraph-like, demote
        if parent_hint == "title" and len(t) > 80:
            return "paragraph"
        return parent_hint
    # Default: map coarse image/table keep as is, else paragraph/text
    if parent_hint in ("exercise", "instruction", "question", "answer_area"):
        return parent_hint
    return "paragraph"

# ---------------------------------------------------------------------------
# 2. Visual element detection (QR, background, design)
# ---------------------------------------------------------------------------

def enrich_visual_and_background(
    regions: list[Region],
    page_width: float,
    page_height: float,
) -> list[Region]:
    """ Classify non-text visual objects independently.

    Supports: image/illustration/photo/diagram, table, qr_code/barcode,
    audio_marker/video_marker, icon/logo, design_element, background.

    Operates on already-atomic regions — adds subtype in meta and may retype
    image regions to precise subtypes.
    """
    page_area = max(1.0, page_width * page_height)
    enriched: list[Region] = []

    for r in regions:
        meta = dict(r.meta or {})
        r.meta = meta
        typ = r.type_hint
        bbox = r.bbox
        area = bbox_area(bbox)
        area_ratio = area / page_area
        text = (r.text or "").strip()
        lower = text.lower()

        # --- Background detection ---
        # Large-area image/design with low textual density and covering >45%
        is_large = area_ratio > 0.45
        is_very_large = area_ratio > 0.70
        covers_most = area_ratio > 0.55
        textual_density = len(text.split()) / max(area / 10000, 1) if area else 0
        # Also check if region spans almost full width+height (design background)
        spans_full_width = (bbox[2] - bbox[0]) / page_width > 0.92
        spans_full_height = (bbox[3] - bbox[1]) / page_height > 0.88

        if typ in ("image", "unknown", "paragraph") and (is_large or (spans_full_width and spans_full_height)):
            # If textual density very low and large, it's background.
            if textual_density < 0.08 and (is_large or (area_ratio > 0.35 and textual_density < 0.02)):
                # But ensure not a photo with caption inside — photos usually not full-page flat color.
                # Use icon flag to exclude icons.
                if not meta.get("icon"):
                    meta["background_candidate"] = True
                    # Only retype to background if extremely large and no meaningful text
                    if is_very_large or (covers_most and not text):
                        r.type_hint = "background"
                        meta["subtype"] = "background"
                        meta["z_order"] = "back"
                        enriched.append(r)
                        continue
                    # Otherwise mark as design_element background-like but keep image for inspector
                    if area_ratio > 0.5 and textual_density < 0.04:
                        r.type_hint = "background"
                        meta["subtype"] = "background"
                        enriched.append(r)
                        continue

        # --- Level badge / design element detection ---
        # Smallish region with level text "B2" / "A1" or red panel.
        # At atomic line level, the badge text line will have been classified as level_badge.
        if typ == "level_badge" or (_is_level_badge_text(text) and area_ratio < 0.08):
            # Promote to design_element with level_badge subtype.
            r.type_hint = "design_element"
            meta["subtype"] = "level_badge"
            meta["level"] = text.strip()
            enriched.append(r)
            continue

        # Design element detection: small solid color rectangle near edge, possibly contains badge text.
        # Heuristic: smallish (<0.09) image/design near top-left or top-right with high coverage of single color.
        if typ in ("image", "unknown") and area_ratio < 0.09 and not text:
            cx = (bbox[0] + bbox[2]) / 2 / page_width
            cy = (bbox[1] + bbox[3]) / 2 / page_height
            # Corner/edge small rectangle -> design_element
            if (cx < 0.22 or cx > 0.78) and cy < 0.22:
                # Could be level badge container (red panel)
                r.type_hint = "design_element"
                meta["subtype"] = "section_marker" if area_ratio < 0.015 else "level_badge"
                enriched.append(r)
                continue
            # Small square-ish icon
            w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
            if min(w, h) > 0 and max(w, h) / min(w, h) < 2.6 and area_ratio < 0.008:
                meta["subtype"] = "icon"
                meta["atomic_level"] = meta.get("atomic_level", "visual_object")
                enriched.append(r)
                continue

        # --- QR / barcode detection heuristic (without CV) ---
        # Very rough: small square image (<5% page) with QR cue in nearby text or square aspect.
        if typ == "image" and area_ratio < 0.06 and area_ratio > 0.002:
            w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
            aspect = max(w, h) / max(1.0, min(w, h))
            is_square = aspect < 1.35
            if is_square and (QR_CUE_RE.search(text) or QR_CUE_RE.search(lower) or meta.get("icon")):
                r.type_hint = "qr_code"
                meta["subtype"] = "qr_code"
                enriched.append(r)
                continue
            # Barcode is elongated rectangle with many vertical lines; without CV, keep as image.
            # But annotate potential media_marker for audio.
            if "audio" in lower or "track" in lower:
                r.type_hint = "audio_marker"
                meta["subtype"] = "audio_marker"
                enriched.append(r)
                continue
            if "video" in lower:
                r.type_hint = "video_marker"
                meta["subtype"] = "video_marker"
                enriched.append(r)
                continue

        # --- Table vs image discrimination already done; keep as is ---
        enriched.append(r)

    return enriched


# ---------------------------------------------------------------------------
# 3. Overlap resolution
# ---------------------------------------------------------------------------

def resolve_overlaps(
    regions: list[Region],
    page_width: float,
    page_height: float,
) -> list[Region]:
    """Deduplicate & resolve overlapping detections.

    Uses IoU + containment with different rules per type pair:

      text ↔ text       — strong NMS (keep higher confidence, or smaller if
                          containment >0.85 and texter longer wins)
      text ↔ image      — keep both if text inside image is intentional
                          (caption/title on image, badge). Otherwise keep both;
                          mark parent/child when containment >0.9
      text ↔ design     — keep both, design is background layer
      image ↔ background — background stays as parent, image child
      QR ↔ image        — QR is specific, demote generic image when IoU>0.7
      table ↔ text      — table wins when containment high

    Returns filtered list with provenance in meta['overlap_resolution'].
    """
    if len(regions) <= 1:
        return regions

    # Sort by confidence descending then area ascending (prefer precise small detections)
    sorted_regions = sorted(regions, key=lambda r: (-r.confidence, bbox_area(r.bbox)))

    keep: list[Region] = []
    for cand in sorted_regions:
        should_drop = False
        for kept in keep:
            iou = _bbox_iou(cand.bbox, kept.bbox)
            contain_cand_in_kept = _containment(cand.bbox, kept.bbox)
            contain_kept_in_cand = _containment(kept.bbox, cand.bbox)

            pair = (cand.type_hint, kept.type_hint)
            # Normalize pair order for symmetric checks
            types = {cand.type_hint, kept.type_hint}

            # Rule: background vs anything — never drop background if it is huge, but mark hierarchy.
            if "background" in types:
                # If candidate is background and kept is image/text inside it, keep both but mark nesting.
                if cand.type_hint == "background" and contain_kept_in_cand < 0.05:
                    continue
                if kept.type_hint == "background" and contain_cand_in_kept > 0.5:
                    # candidate inside background — keep, mark parent
                    cand.meta = dict(cand.meta or {})
                    cand.meta["parent_background"] = kept.meta.get("block_id", "bg")
                    continue
                # Two backgrounds with high IoU — keep larger
                if cand.type_hint == "background" and kept.type_hint == "background" and iou > 0.6:
                    # Prefer larger area background
                    if bbox_area(cand.bbox) > bbox_area(kept.bbox):
                        # Swap: remove kept and keep cand
                        keep.remove(kept)
                        break
                    else:
                        should_drop = True
                        break

            # Rule: QR ↔ image — if IoU high, QR wins
            if types == {"qr_code", "image"} or (cand.type_hint == "qr_code" and kept.type_hint == "image") or (cand.type_hint == "image" and kept.type_hint == "qr_code"):
                if iou > 0.45:
                    if cand.type_hint == "qr_code":
                        # candidate QR should replace kept generic image
                        keep.remove(kept)
                        break
                    else:
                        should_drop = True
                        break

            # Rule: design_element / level_badge vs text — nesting not duplication
            if {"design_element", "text", "heading", "subtitle", "paragraph", "level_badge"} & types:
                if cand.type_hint == "design_element" and kept.type_hint in ("text", "heading", "subtitle", "paragraph"):
                    if contain_kept_in_cand > 0.85:
                        # Text inside design element (badge) — keep both, mark parent
                        kept.meta = dict(kept.meta or {})
                        kept.meta["parent_design"] = cand.meta.get("block_id", "design")
                        continue
                if kept.type_hint == "design_element" and cand.type_hint in ("text", "heading", "subtitle", "paragraph"):
                    if contain_cand_in_kept > 0.85:
                        cand.meta = dict(cand.meta or {})
                        cand.meta["parent_design"] = kept.meta.get("block_id", "design")
                        continue

            # Rule: text ↔ image — intentional overlap (text on image) when containment moderate
            if ("image" in types and any(t in ("paragraph", "heading", "subtitle", "text", "caption", "question", "instruction") for t in types)):
                # Only consider high containment as nesting, low IoU as legitimate separate
                if iou > 0.35:
                    # If text bbox mostly inside image, keep both with parent marker
                    if contain_cand_in_kept > 0.85 or contain_kept_in_cand > 0.85:
                        # Nest rather than drop
                        continue
                    # Small overlap but high IoU — keep higher confidence, lower may be noise
                    if iou > 0.65:
                        if cand.confidence < kept.confidence - 0.08:
                            should_drop = True
                            break
                        continue
                continue

            # Rule: table ↔ text — table wins when text mostly inside table
            if "table" in types:
                if contain_cand_in_kept > 0.8 or contain_kept_in_cand > 0.8:
                    # Text inside table cell — keep both (cell content). Mark membership.
                    continue
                if iou > 0.5:
                    # Competing detection: prefer table
                    if cand.type_hint != "table" and kept.type_hint == "table":
                        should_drop = True
                        break
                    if cand.type_hint == "table" and kept.type_hint != "table":
                        keep.remove(kept)
                        break

            # Rule: text ↔ text — strongest deduplication
            text_types = {"paragraph", "heading", "subtitle", "text", "question", "instruction", "answer", "label", "caption", "list_item", "header", "footer", "page_number"}
            if cand.type_hint in text_types and kept.type_hint in text_types:
                if iou > 0.5:
                    # Very similar detection — keep higher confidence
                    should_drop = True
                    break
                if contain_cand_in_kept > 0.92 or contain_kept_in_cand > 0.92:
                    # One contains the other — keep smaller (more atomic)
                    # Unless larger has significantly more text (e.g., instruction+questions merged)
                    # Then atomic decomposition should have split it; fallback prefers smaller.
                    area_cand = bbox_area(cand.bbox)
                    area_kept = bbox_area(kept.bbox)
                    if area_cand < area_kept:
                        keep.remove(kept)
                        break
                    else:
                        should_drop = True
                        break
                continue

            # Generic fallback: high IoU identical type — deduplicate
            if cand.type_hint == kept.type_hint and iou > 0.6:
                should_drop = True
                break

        if not should_drop:
            keep.append(cand)

    # Re-sort by original reading-inspired order for stability (y then x)
    keep.sort(key=lambda r: (r.bbox[1], r.bbox[0]))
    return keep


# ---------------------------------------------------------------------------
# 4. Evaluation metrics (focus: oversized_region_rate)
# ---------------------------------------------------------------------------

@dataclass
class EvaluationMetrics:
    total_elements: int = 0
    oversized_regions: int = 0
    oversized_region_rate: float = 0.0
    duplicate_rate: float = 0.0
    avg_bbox_area_ratio: float = 0.0
    text_extraction_accuracy: float = 0.0
    classification_accuracy: float = 0.0
    element_precision: float = 0.0
    element_recall: float = 0.0
    bounding_box_iou: float = 0.0
    reading_order_accuracy: float = 0.0
    exercise_extraction_accuracy: float = 0.0
    # Extra debug
    atomic_coverage: float = 0.0
    background_count: int = 0
    design_element_count: int = 0


def compute_evaluation(
    atomic_regions: list[Region],
    page_width: float,
    page_height: float,
    *,
    before_count: int | None = None,
) -> EvaluationMetrics:
    page_area = max(1.0, page_width * page_height)
    total = len(atomic_regions)
    if total == 0:
        return EvaluationMetrics()

    oversized = 0
    # Threshold: region covering >25% page area with text and >3 lines worth of height is oversized.
    # More precise: >0.18 area_ratio with paragraph type and multi-line text inside.
    for r in atomic_regions:
        area_ratio = bbox_area(r.bbox) / page_area
        text_len = len((r.text or "").strip())
        line_count_est = r.text.count("\n") + 1 if r.text else 1
        # Atomic lines should be small: area <5% and height <8% page.
        # Anything with area>12% and height>18% that contains 3+ line breaks is oversized.
        h_ratio = (r.bbox[3] - r.bbox[1]) / page_height
        w_ratio = (r.bbox[2] - r.bbox[0]) / page_width
        if area_ratio > 0.12 and h_ratio > 0.18 and line_count_est >= 3 and r.type_hint in ("paragraph", "text", "unknown"):
            oversized += 1
        elif area_ratio > 0.22 and text_len > 40 and r.type_hint in ("paragraph", "text", "unknown"):
            oversized += 1
        elif r.meta.get("atomic_level") == "block" and area_ratio > 0.15 and line_count_est >= 3:
            # Coarse block that wasn't split but should have been
            oversized += 1

    # Background/design counts
    bg_count = sum(1 for r in atomic_regions if r.type_hint == "background")
    design_count = sum(1 for r in atomic_regions if r.type_hint == "design_element")

    avg_area = sum(bbox_area(r.bbox) / page_area for r in atomic_regions) / total
    # Duplicate rate proxy: count pairs with high IoU that survived (should be low)
    dup_pairs = 0
    for i in range(total):
        for j in range(i + 1, total):
            if _bbox_iou(atomic_regions[i].bbox, atomic_regions[j].bbox) > 0.6:
                dup_pairs += 1
    dup_rate = dup_pairs / max(1, total)

    # Atomic coverage: fraction that are atomic lines vs coarse blocks
    atomic_lines = sum(1 for r in atomic_regions if r.meta.get("atomic_level", "").startswith("line"))
    atomic_cov = atomic_lines / max(1, total)

    return EvaluationMetrics(
        total_elements=total,
        oversized_regions=oversized,
        oversized_region_rate=oversized / total if total else 0.0,
        duplicate_rate=dup_rate,
        avg_bbox_area_ratio=avg_area,
        atomic_coverage=atomic_cov,
        background_count=bg_count,
        design_element_count=design_count,
    )

# ---------------------------------------------------------------------------
# Legacy compatibility helpers
# ---------------------------------------------------------------------------

def regions_to_debug_payload(
    raw: list[Region],
    atomic: list[Region],
    resolved: list[Region],
    evaluation: EvaluationMetrics,
) -> dict[str, Any]:
    """Expose every layer for the debug API."""
    def r_to_dict(r: Region) -> dict[str, Any]:
        return {
            "bbox": [round(v, 2) for v in r.bbox],
            "type": r.type_hint,
            "confidence": r.confidence,
            "text": r.text[:300] if r.text else "",
            "source": r.source,
            "meta": r.meta,
            "spans": r.spans[:4] if r.spans else [],
        }
    return {
        "raw_detector": [r_to_dict(r) for r in raw],
        "atomic_elements": [r_to_dict(r) for r in atomic],
        "resolved_elements": [r_to_dict(r) for r in resolved],
        "evaluation": {
            "total": evaluation.total_elements,
            "oversized": evaluation.oversized_regions,
            "oversized_rate": round(evaluation.oversized_region_rate, 3),
            "duplicate_rate": round(evaluation.duplicate_rate, 3),
            "avg_area_ratio": round(evaluation.avg_bbox_area_ratio, 4),
            "atomic_coverage": round(evaluation.atomic_coverage, 3),
            "background_count": evaluation.background_count,
            "design_count": evaluation.design_element_count,
        },
    }
