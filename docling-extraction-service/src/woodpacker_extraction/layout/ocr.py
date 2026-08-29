"""Per-block OCR layer (Stage 4).

Rule #1: NEVER OCR an entire page. OCR runs on individually cropped blocks.

Engine priority (env ``OCR_PROVIDER_ORDER``,
default ``documentai,google_vision,paddleocr,surya``):

1. documentai    - recognized text arrives with Document AI layout results
2. google_vision - Google Cloud Vision (needs GCP credentials)
3. paddleocr     - PaddleOCR (optional install)
4. surya         - offline fallback (installed)

Blocks that come from a digital text layer are NOT OCRed at all: their text
is authoritative (``engine="text_layer"``, confidence 1.0).
"""

from __future__ import annotations

import logging
import os
from typing import Any

from .types import LayoutBlock, OcrText

logger = logging.getLogger(__name__)

_MIN_OCR_AREA = 250.0  # px^2; smaller crops carry no meaningful text


def ocr_provider_order() -> list[str]:
    raw = os.environ.get("OCR_PROVIDER_ORDER", "documentai,google_vision,paddleocr,surya")
    return [p.strip() for p in raw.split(",") if p.strip()]


def run_block_ocr(
    blocks: list[LayoutBlock],
    crops: dict[str, Any],
    *,
    docai_texts: dict[str, tuple[str, float]] | None = None,
) -> list[OcrText]:
    """OCR every text-bearing block individually.

    ``docai_texts`` maps block_id -> (recognized_text, confidence) when the
    layout stage ran on Document AI (reuse, no second API call).
    """
    docai_texts = docai_texts or {}
    order = ocr_provider_order()
    results: list[OcrText] = []

    for block in blocks:
        if _is_text_layer_block(block):
            results.append(OcrText(block.block_id, block.text, 1.0, "text_layer"))
            continue
        if block.type == "image":
            continue  # image blocks get vision understanding, not OCR

        crop = crops.get(block.block_id)
        if crop is None:
            if block.text.strip():
                results.append(OcrText(block.block_id, block.text, 0.9, "layout"))
            continue
        if (crop.width * crop.height) < _MIN_OCR_AREA:
            continue

        outcome: OcrText | None = None
        for engine in order:
            try:
                if engine == "documentai":
                    payload = docai_texts.get(block.block_id)
                    if payload and payload[0].strip():
                        outcome = OcrText(block.block_id, payload[0].strip(), float(payload[1]), "documentai")
                elif engine == "google_vision":
                    outcome = _google_vision_ocr(crop)
                elif engine == "paddleocr":
                    outcome = _paddle_ocr(crop)
                elif engine == "surya":
                    outcome = _surya_ocr(crop)
            except Exception as exc:  # noqa: BLE001
                logger.debug("OCR engine %s failed for %s: %s", engine, block.block_id, exc)
                outcome = None
            if outcome is not None and outcome.text.strip():
                break
            outcome = None

        if outcome is None and block.text.strip():
            outcome = OcrText(block.block_id, block.text, 0.85, block.source or "layout")
        if outcome is not None:
            results.append(outcome)
    return results


def _is_text_layer_block(block: LayoutBlock) -> bool:
    return bool(block.text.strip()) and (
        block.source == "pymupdf" or any(s.font_name for s in block.spans)
    )


# ---------------------------------------------------------------------------
# Engines (each guarded; returns None on unavailability)
# ---------------------------------------------------------------------------


def _google_vision_ocr(img: Any) -> OcrText | None:
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        return None
    try:
        import io

        from google.cloud import vision

        client = vision.ImageAnnotatorClient()
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        image = vision.Image(content=buf.getvalue())
        response = client.document_text_detection(image=image)
        if response.error.message:
            logger.warning("Google Vision error: %s", response.error.message)
            return None
        annotation = response.full_text_annotation
        conf = 0.95
        try:
            pages = list(annotation.pages or [])
            if pages and pages[0].confidence:
                conf = float(pages[0].confidence)
        except Exception:  # noqa: BLE001
            pass
        text = (annotation.text or "").strip()
        if not text:
            return None
        return OcrText("", text, conf, "google_vision")
    except Exception as exc:  # noqa: BLE001
        logger.debug("google_vision unavailable: %s", exc)
        return None


_paddle_engine: Any | None = None


def _get_paddle() -> Any | None:
    global _paddle_engine
    if _paddle_engine is None:
        try:
            from paddleocr import PaddleOCR

            _paddle_engine = PaddleOCR(use_textline_orientation=True, lang="german")
        except Exception as exc:  # noqa: BLE001
            logger.info("PaddleOCR unavailable: %s", exc)
            return None
    return _paddle_engine


def _paddle_ocr(img: Any) -> OcrText | None:
    engine = _get_paddle()
    if engine is None:
        return None
    try:
        import numpy as np

        arr = np.asarray(img.convert("RGB"))[:, :, ::-1]
        result = engine.predict(arr)
        lines: list[str] = []
        scores: list[float] = []
        for page_res in result or []:
            for text, score in zip(
                page_res.get("rec_texts", []) or [],
                page_res.get("rec_scores", []) or [],
            ):
                if str(text).strip():
                    lines.append(str(text))
                    scores.append(float(score))
        if not lines:
            return None
        conf = sum(scores) / len(scores) if scores else 0.8
        return OcrText("", "\n".join(lines), max(0.3, min(1.0, conf)), "paddleocr")
    except Exception as exc:  # noqa: BLE001
        logger.debug("PaddleOCR failed: %s", exc)
        return None


_surya_recognizer: Any | None = None


def _get_surya() -> Any | None:
    global _surya_recognizer
    if _surya_recognizer is None:
        try:
            from surya.recognition import RecognitionPredictor
            from surya.inference import get_default_manager

            _surya_recognizer = RecognitionPredictor(get_default_manager())
        except Exception as exc:  # noqa: BLE001
            logger.info("Surya recognition unavailable: %s", exc)
            return None
    return _surya_recognizer


import re as _re  # noqa: E402

_HTML_TAG_RE = _re.compile(r"<[^>]+>")


def _strip_html(raw: str) -> str:
    text = _HTML_TAG_RE.sub("", raw or "")
    return text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").strip()


def _surya_ocr(img: Any) -> OcrText | None:
    recognizer = _get_surya()
    if recognizer is None:
        return None
    results = recognizer([img])
    lines: list[str] = []
    confidences: list[float] = []
    for result in results:
        for block in getattr(result, "blocks", []) or []:
            if getattr(block, "skipped", False) or getattr(block, "error", None):
                continue
            text = _strip_html(getattr(block, "html", "") or "")
            if not text:
                continue
            lines.append(text)
            conf = getattr(block, "confidence", None)
            if isinstance(conf, (int, float)):
                confidences.append(float(conf))
    if not lines:
        return None
    conf = sum(confidences) / len(confidences) if confidences else 0.85
    return OcrText("", "\n".join(lines), max(0.3, min(1.0, conf)), "surya")
