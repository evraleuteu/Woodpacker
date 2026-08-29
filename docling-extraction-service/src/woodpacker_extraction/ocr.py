"""OCR layer for scanned PDFs and standalone images.

Stage 2 (continued): When a PDF has no extractable text (scanned pages),
fall back to OCR. Also serves ``POST /extract/image`` for uploaded
screenshots/photos of textbook pages (``ocr_image``).

Priority:
1. Google Document AI — best accuracy, layout understanding, tables, forms
2. Surya OCR — open-source fallback, works offline
3. Tesseract — avoided (per spec, accuracy insufficient for textbooks)

The Google Document AI path requires GOOGLE_APPLICATION_CREDENTIALS and
the document-ai library. Surya requires the surya library.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass

import pymupdf

logger = logging.getLogger(__name__)

# These are optional — only imported when the respective OCR backend is used.
# pylint: disable=import-outside-toplevel

_HTML_TAG_RE = re.compile(r"<[^>]+>")

# Safety bound for the offline OCR path (pages OCR'd per document).
MAX_OCR_PAGES = 300
_MIN_TEXT_CHARS = 20


@dataclass
class OcrResult:
    text: str
    confidence: float
    blocks: list[dict]  # layout-aware blocks with coordinates


def ocr_image(img: "Image.Image", lang: str = "de") -> str:
    """OCR a PIL image using Surya OCR (VLM-based, surya-ocr >= 0.20).

    Requires: pip install surya-ocr

    Surya 0.22 uses a VLM inference manager (llama.cpp on CPU, vllm on GPU).
    The first call downloads the model weights.
    """
    predictor = _get_surya_predictor()

    lines: list[str] = []
    try:
        results = predictor([img])
    except Exception as exc:  # noqa: BLE001
        logger.warning("Surya inference failed: %s", exc)
        return ""

    for result in results:
        for block in getattr(result, "blocks", []):
            if block.skipped or block.error:
                continue
            text = _HTML_TAG_RE.sub("", block.html)
            text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
            text = text.strip()
            if text:
                lines.append(text)
    return "\n".join(lines)


def ocr_page_surya(page: pymupdf.Page, lang: str = "de") -> str:
    """OCR a single PDF page using Surya OCR (renders the page, then ocr_image)."""
    from PIL import Image

    dpi = int(os.environ.get("OCR_DPI", "200"))
    pix = page.get_pixmap(dpi=dpi)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    return ocr_image(img, lang=lang)


_surya_predictor = None


def _get_surya_predictor():
    """Module-level singleton Surya predictor (loads VLM once per process)."""
    global _surya_predictor
    if _surya_predictor is None:
        from surya.recognition import RecognitionPredictor
        from surya.inference import get_default_manager

        _surya_predictor = RecognitionPredictor(get_default_manager())
    return _surya_predictor


def ocr_pdf_documentai(pdf_path: str, project_id: str | None = None, location: str = "eu") -> str:
    """OCR a full PDF using Google Document AI.

    Preferred OCR per the spec: better accuracy, layout, tables, forms.

    Requires:
        - GOOGLE_APPLICATION_CREDENTIALS env var set
        - pip install google-cloud-document-ai

    ``project_id`` and ``location`` are retained as compatibility arguments;
    processor selection is controlled by the environment-backed provider.
    """
    with open(pdf_path, "rb") as f:
        pdf_data = f.read()

    from .layout.providers.documentai import process_document_with_docai

    document = process_document_with_docai(pdf_data, "application/pdf", "ocr")
    return document.text or ""


def ocr_scanned_pdf(pdf_path: str, lang: str = "de") -> str:
    """OCR a PDF: render ONLY textless pages to images, run Surya, assemble.

    Page-level decision: pages that already carry a digital text layer are
    kept as-is (no OCR, no hallucination risk); OCR runs per page that needs
    it. Output preserves `[PAGE n]` markers aligned to real page numbers so
    downstream page attribution stays correct.
    """
    from .extractor import scan_profile

    profile = scan_profile(pdf_path)
    doc = pymupdf.open(pdf_path)
    all_text: list[str] = []

    try:
        for i in range(min(doc.page_count, MAX_OCR_PAGES)):
            page = doc[i]
            existing = page.get_text().strip()
            if len(existing) > _MIN_TEXT_CHARS:
                # Digital page — never send through OCR.
                all_text.append(f"[PAGE {i + 1}]\n{existing}")
                continue
            try:
                text = ocr_page_surya(page, lang=lang)
                if text:
                    all_text.append(f"[PAGE {i + 1}]\n{text}")
            except Exception as exc:
                logger.warning("Surya OCR failed for page %d: %s", i + 1, exc)
    finally:
        doc.close()
    return "\n".join(all_text)


def smart_text_extraction(pdf_path: str) -> tuple[str, bool, str]:
    """Intelligently extract text: try PyMuPDF first, fall back to OCR.

    Returns (text, was_ocr_used, engine_used).
    """
    from .extractor import extract_text, is_scanned_pdf

    text, page_count = extract_text(pdf_path)

    if page_count > 0 and len(text.strip()) < 50:
        # Likely scanned
        if is_scanned_pdf(pdf_path):
            logger.info("PDF appears scanned, attempting OCR with Surya...")
            try:
                ocr_text = ocr_scanned_pdf(pdf_path)
                if ocr_text and len(ocr_text.strip()) > len(text):
                    return ocr_text, True, "surya"
            except Exception as exc:
                logger.warning("Surya OCR failed: %s", exc)

            # Try Google Document AI
            gcp_project = os.environ.get("GOOGLE_CLOUD_PROJECT")
            if gcp_project:
                try:
                    ocr_text = ocr_pdf_documentai(pdf_path, gcp_project)
                    if ocr_text:
                        return ocr_text, True, "documentai"
                except Exception as exc:
                    logger.warning("Document AI OCR failed: %s", exc)

    # Either text was found or OCR didn't help
    return text, False, "pymupdf"
