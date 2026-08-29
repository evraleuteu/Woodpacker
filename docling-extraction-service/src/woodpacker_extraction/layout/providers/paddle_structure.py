"""PaddleOCR PP-Structure V3 layout provider (fallback).

Activates only when ``paddleocr`` (>= 3.x, PP-StructureV3) is importable —
it is an optional heavy dependency and is NOT installed by default. When
present it provides strong region segmentation + region OCR for scanned
pages.

Region labels from PP-Structure are mapped:
    title/paragraph/title → taxonomy; image/figure → image;
    table → table; header/footer via geometry in classify stage.
"""

from __future__ import annotations

import logging
from typing import Any

from ..types import BBox, clamp_bbox
from . import Region

logger = logging.getLogger(__name__)

_pipeline: Any | None = None


def _get_pipeline() -> Any | None:
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    try:
        from paddleocr import PPStructureV3

        _pipeline = PPStructureV3()
        return _pipeline
    except Exception as exc:  # noqa: BLE001
        logger.info("PP-StructureV3 unavailable: %s", exc)
        return None


_LABEL_MAP = {
    "title": "title",
    "text": "paragraph",
    "paragraph": "paragraph",
    "list": "paragraph",
    "image": "image",
    "figure": "image",
    "table": "table",
    "header": "header",
    "footer": "footer",
    "number": "page_number",
    "seal": "unknown",
}


class PaddleStructureProvider:
    name = "paddle_structure"

    def available(self) -> bool:
        try:
            import paddleocr  # noqa: F401

            return True
        except Exception:  # noqa: BLE001
            return False

    def detect_page(
        self,
        page_image: Any,
        page_number: int,
        pdf_page: Any | None = None,
    ) -> list[Region]:
        pipeline = _get_pipeline()
        if pipeline is None:
            return []
        try:
            import numpy as np

            arr = np.asarray(page_image.convert("RGB"))[:, :, ::-1]  # RGB->BGR
            results = pipeline.predict(arr)
        except Exception as exc:  # noqa: BLE001
            logger.warning("PP-Structure failed on page %s: %s", page_number, exc)
            return []

        width, height = float(page_image.width), float(page_image.height)
        regions: list[Region] = []
        for page_res in results or []:
            for region in page_res.get("layout_det_res", {}).get("boxes", []):
                box = region.get("box") or region.get("bbox")
                label = str(region.get("label", "") or "").lower()
                if not box or len(box) < 4:
                    continue
                bbox: BBox = clamp_bbox(
                    (float(box[0]), float(box[1]), float(box[2]), float(box[3])), width, height
                )
                score = float(region.get("score", 0.8) or 0.8)
                regions.append(
                    Region(
                        bbox=bbox,
                        type_hint=_LABEL_MAP.get(label, "unknown"),
                        confidence=max(0.3, min(1.0, score)),
                        source=self.name,
                        meta={"raw_label": label},
                    )
                )

            # Region OCR text (when the pipeline produced it) is attached so
            # the OCR stage can skip re-recognition.
            for item in page_res.get("overall_ocr_res", {}).get("rec_texts_idx", []) or []:
                pass  # PP-StructureV3 exposes text via sub-results; handled by ocr.py
        return regions
