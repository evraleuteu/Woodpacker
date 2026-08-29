"""Surya LayoutPredictor provider (OCR-based layout for scanned pages).

Surya 0.22 ships a VLM-based layout model whose canonical labels are mapped
onto the Woodpacker block taxonomy:

    SectionHeader -> title        Picture/Image/Figure/Diagram -> image
    Text/ListGroup/Bibliography/Footnote/Code/Equation -> paragraph
    Caption -> caption            Table/Form -> table
    PageHeader -> header          PageFooter -> footer
    TableOfContents/BlankPage -> unknown (dropped when blank)

Regions arrive in the pixel space of the input image, which is our render
space — no rescaling needed.
"""

from __future__ import annotations

import logging
from typing import Any

from ..types import BBox, clamp_bbox
from . import Region

logger = logging.getLogger(__name__)

_LABEL_MAP = {
    "SectionHeader": "title",
    "Text": "paragraph",
    "ListGroup": "paragraph",
    "Bibliography": "paragraph",
    "Footnote": "caption",
    "Code": "paragraph",
    "Equation": "paragraph",
    "Caption": "caption",
    "Picture": "image",
    "Image": "image",
    "Figure": "image",
    "Diagram": "image",
    "Table": "table",
    "Form": "table",
    "PageHeader": "header",
    "PageFooter": "footer",
}

_DROPPED_LABELS = {"BlankPage", "TableOfContents", "ChemicalBlock"}

_predictor: Any | None = None


def _get_predictor() -> Any:
    global _predictor
    if _predictor is None:
        from surya.layout import LayoutPredictor

        _predictor = LayoutPredictor()
    return _predictor


class SuryaLayoutProvider:
    name = "surya"

    def available(self) -> bool:
        try:
            import surya.layout  # noqa: F401

            return True
        except Exception:  # noqa: BLE001
            return False

    def detect_page(
        self,
        page_image: Any,
        page_number: int,
        pdf_page: Any | None = None,
    ) -> list[Region]:
        try:
            predictor = _get_predictor()
            results = predictor([page_image])
        except Exception as exc:  # noqa: BLE001
            logger.warning("Surya layout failed on page %s: %s", page_number, exc)
            return []

        regions: list[Region] = []
        width, height = page_image.size
        for result in results:
            boxes = list(getattr(result, "blocks", []) or [])
            boxes.sort(key=lambda b: getattr(b, "position", 0))
            for box in boxes:
                label = str(getattr(box, "label", "") or "")
                if label in _DROPPED_LABELS:
                    continue
                raw = getattr(box, "bbox", None)
                if raw is None:
                    continue
                bb = [float(v) for v in list(raw)[:4]]
                if len(bb) < 4:
                    continue
                bbox = clamp_bbox((bb[0], bb[1], bb[2], bb[3]), float(width), float(height))
                confidence = float(getattr(box, "confidence", 0.75) or 0.75)
                regions.append(
                    Region(
                        bbox=bbox,
                        type_hint=_LABEL_MAP.get(label, "unknown"),
                        confidence=max(0.3, min(1.0, confidence)),
                        source=self.name,
                        meta={"raw_label": str(getattr(box, "raw_label", label) or label)},
                    )
                )
        return regions
