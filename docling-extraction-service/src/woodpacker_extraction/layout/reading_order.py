"""Deterministic reading order (column-aware + atomic-aware).

Textbook pages are frequently multi-column (exercises left, images right).
Algorithm:

1. Exclude background elements (they have no reading order).
2. Find vertical gutters: x-intervals with zero block coverage across the
   page's occupied y-range.
3. Split blocks into column groups at gutters wider than 4% of page width.
4. Sort columns left-to-right; sort blocks within a column top-to-bottom
   (with a small tolerance for slightly overlapping baselines).
5. Assign readingOrder index; header/footer/caption are sequenced with
   structural awareness (header before body, footer after, captions after figures).
"""

from __future__ import annotations

from .types import LayoutBlock

_Y_TOLERANCE = 0.6  # fraction of the taller block height used when grouping lines


def order_page_blocks(blocks: list[LayoutBlock], page_width: float) -> list[LayoutBlock]:
    """Return the blocks of one page in reading order."""
    # Background/design backdrop has no reading order — keep at start/end but don't interleave.
    content = [b for b in blocks if b.type != "background" and b.meta.get("subtype") != "background"]
    backgrounds = [b for b in blocks if b.type == "background" or b.meta.get("subtype") == "background"]
    if len(content) <= 1:
        ordered = list(content)
        # Backgrounds first (z-back), then content, then decorations by type? Keep stable.
        return backgrounds + ordered

    # Structural buckets: header/footer/page_number/caption handled geometrically but weighted
    # so headers sort before body and footers after.
    columns = _split_columns(content, page_width)
    ordered: list[LayoutBlock] = []
    for column in columns:
        if not column:
            continue
        # Separate structural from body for weighting
        headers = [b for b in column if b.type in ("header", "page_number")]
        footers = [b for b in column if b.type in ("footer",)]
        body = [b for b in column if b.type not in ("header", "footer", "page_number")]
        # Body is column-aware sorted
        body_ordered: list[LayoutBlock] = []
        if body:
            tol = max(b.bbox[3] - b.bbox[1] for b in body) * _Y_TOLERANCE + 1.0
            remaining = sorted(body, key=lambda b: (b.bbox[1], b.bbox[0]))
            while remaining:
                anchor = remaining.pop(0)
                line = [anchor]
                anchor_mid = (anchor.bbox[1] + anchor.bbox[3]) / 2
                keep: list[LayoutBlock] = []
                for cand in remaining:
                    cand_mid = (cand.bbox[1] + cand.bbox[3]) / 2
                    if abs(cand_mid - anchor_mid) <= tol:
                        line.append(cand)
                    else:
                        keep.append(cand)
                line.sort(key=lambda b: b.bbox[0])
                body_ordered.extend(line)
                remaining = keep
        # Headers before body, footers after, captions travel with nearest image/table
        ordered.extend(sorted(headers, key=lambda b: b.bbox[1]))
        ordered.extend(body_ordered)
        ordered.extend(sorted(footers, key=lambda b: b.bbox[1]))

    # Inject captions immediately after their figure when possible — simple proximity heuristic
    captions = [b for b in ordered if b.type == "caption"]
    if captions:
        non_caps = [b for b in ordered if b.type != "caption"]
        # For each caption, place after nearest image/table above it
        # Already sorted, keep stable: move caption to after nearest image in same column region
        reordered: list[LayoutBlock] = []
        for b in non_caps:
            reordered.append(b)
            # Collect captions whose y is within 1.5*page height fraction below this image
            if b.type in ("image", "table", "photo", "illustration"):
                # Find captions that overlap horizontally and are just below
                pulled = []
                for cap in list(captions):
                    if cap in reordered:
                        continue
                    horiz_overlap = max(0.0, min(b.bbox[2], cap.bbox[2]) - max(b.bbox[0], cap.bbox[0])) > 10
                    vert_below = 0 < (cap.bbox[1] - b.bbox[3]) < 180
                    if horiz_overlap and vert_below:
                        pulled.append(cap)
                for pc in pulled:
                    captions.remove(pc)
                    reordered.append(pc)
        # Any remaining captions at end
        reordered.extend(captions)
        ordered = reordered

    return backgrounds + ordered


def _split_columns(blocks: list[LayoutBlock], page_width: float) -> list[list[LayoutBlock]]:
    """Split into column groups using the largest geometric gap between centers."""
    centers = sorted((b.bbox[0] + b.bbox[2]) / 2 for b in blocks)
    occupied_span = max(centers[-1] - centers[0], 1.0)
    width_ref = max(float(page_width), occupied_span)

    # Find gaps between neighboring sorted centers; prefer a gap that cleanly
    # separates left/right halves (is wider than both 6% of page width and 25%
    # of the occupied span — textbook columns leave ample gutter).
    best_gap = 0.0
    best_split_idx = -1
    for i in range(1, len(centers)):
        gap = centers[i] - centers[i - 1]
        if gap > best_gap:
            best_gap = gap
            best_split_idx = i

    gutter_ok = best_gap >= width_ref * 0.06 and best_gap >= occupied_span * 0.25
    if best_split_idx < 0 or not gutter_ok or len(centers) < 4:
        return [list(blocks)]

    split_x = (centers[best_split_idx - 1] + centers[best_split_idx]) / 2
    left = [b for b in blocks if (b.bbox[0] + b.bbox[2]) / 2 < split_x]
    right = [b for b in blocks if (b.bbox[0] + b.bbox[2]) / 2 >= split_x]
    if not left or not right or len(left) < 2 or len(right) < 2:
        return [list(blocks)]
    return [left, right]
