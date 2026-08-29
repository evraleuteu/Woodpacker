"""Google Document AI layout provider (primary when GCP is configured).

Activates only when all of the selected processor's configuration is present:
    * ``google-cloud-documentai`` importable
    * ``GOOGLE_APPLICATION_CREDENTIALS`` set and points to a file
    * ``GOOGLE_CLOUD_PROJECT`` set
    * ``DOCAI_LAYOUT_PROCESSOR_ID`` set

The OCR processor is configured separately through
``DOCAI_OCR_PROCESSOR_ID``. Layout detection always selects the layout
processor; OCR callers must explicitly select the OCR processor.

Uses the batch ``process_document`` API per page image (or the raw PDF when
``DOCAI_MODE=pdf``) and maps ``document.pages[].blocks`` onto our taxonomy via
the detected style type + geometry. Coordinates arrive normalized
(0..1) and are converted to render pixels.

Because DocAI also returns recognized text per block, the OCR stage reuses
these results (engine="documentai") instead of re-OCR-ing.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from ..types import BBox, clamp_bbox, RENDER_DPI
from . import Region

logger = logging.getLogger(__name__)

# DocAI style type -> block taxonomy
_STYLE_MAP = {
    "TITLE": "title",
    "HEADING": "subtitle",
    "PARAGRAPH": "paragraph",
    "HEADER": "header",
    "FOOTER": "footer",
    "PAGE_NUMBER": "page_number",
    "CAPTION": "caption",
    "TABLE": "table",
    "FORM": "answer_area",
    "PICTURE": "image",
    "LIST": "list",
    "LIST_ITEM": "list_item",
}

_client: Any | None = None
_client_key: tuple[str, str] | None = None
_document_cache: dict[int, Any] = {}


class DocumentAIProviderError(RuntimeError):
    """Safe provider error that identifies the operation without secrets."""


def clear_document_cache() -> None:
    """Release document-level responses cached for one pipeline run."""
    _document_cache.clear()


def configuration_error(processor: str = "layout") -> str | None:
    """Return a safe configuration error without exposing secret values."""
    required = [
        "GOOGLE_CLOUD_PROJECT",
        "GOOGLE_APPLICATION_CREDENTIALS",
        "DOCAI_LAYOUT_PROCESSOR_ID" if processor == "layout" else "DOCAI_OCR_PROCESSOR_ID",
    ]
    missing = [name for name in required if not os.environ.get(name, "").strip()]
    if missing:
        return "missing " + " / ".join(missing)

    credentials = os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
    if not Path(credentials).is_file():
        return "GOOGLE_APPLICATION_CREDENTIALS file is not readable"
    return None


def _configured(processor: str = "layout") -> bool:
    return configuration_error(processor) is None


def _get_client(processor: str = "layout") -> tuple[Any, str]:
    global _client, _client_key
    config_error = configuration_error(processor)
    if config_error:
        raise RuntimeError(f"Google Document AI {processor} configuration invalid: {config_error}")

    project = os.environ["GOOGLE_CLOUD_PROJECT"]
    location = os.environ.get("DOCAI_LOCATION", "eu").strip() or "eu"
    processor_id = os.environ[
        "DOCAI_LAYOUT_PROCESSOR_ID" if processor == "layout" else "DOCAI_OCR_PROCESSOR_ID"
    ]
    key = (location, processor_id)
    if _client is None or _client_key != key:
        import google.cloud.documentai as documentai

        opts = {"api_endpoint": f"{location}-documentai.googleapis.com"}
        _client = documentai.DocumentProcessorServiceClient(client_options=opts)
        _client_key = key
    processor_name = f"projects/{project}/locations/{location}/processors/{processor_id}"
    return _client, processor_name


def process_document_with_docai(
    content: bytes,
    mime_type: str,
    processor: str = "layout",
) -> Any:
    """Process bytes with the explicitly selected OCR or layout processor."""
    import google.cloud.documentai as documentai

    client, name = _get_client(processor)
    raw_document = documentai.RawDocument(content=content, mime_type=mime_type)
    request = documentai.ProcessRequest(name=name, raw_document=raw_document)
    try:
        result = client.process_document(request=request)
    except Exception as exc:  # noqa: BLE001
        code = getattr(getattr(exc, "code", None), "name", None)
        detail = str(exc).splitlines()[0].strip() or type(exc).__name__
        reason = f"{code}: {detail}" if code else detail
        raise DocumentAIProviderError(
            f"Google Document AI {processor} processor failed: {reason}"
        ) from exc
    return result.document


def _page_blocks(document: Any, fallback_page_number: int) -> list[tuple[int, Any]]:
    """Read OCR-style page blocks or Layout Parser document-level blocks."""
    entries: list[tuple[int, Any]] = []
    pages = list(getattr(document, "pages", None) or [])
    for page in pages:
        page_number = int(getattr(page, "page_number", 0) or fallback_page_number)
        if len(pages) > 1 and page_number != fallback_page_number:
            continue
        entries.extend((page_number, block) for block in (getattr(page, "blocks", None) or []))

    # Layout Parser responses expose blocks under document_layout rather than
    # pages. The request is one rendered page, so the caller's page number is
    # the authoritative page relationship for these blocks.
    if not entries:
        document_layout = getattr(document, "document_layout", None)
        for block in getattr(document_layout, "blocks", None) or []:
            page_span = getattr(block, "page_span", None)
            page_start = int(getattr(page_span, "page_start", 0) or 0)
            page_end = int(getattr(page_span, "page_end", 0) or page_start)
            if page_start and not (page_start <= fallback_page_number <= max(page_start, page_end)):
                continue
            entries.append((fallback_page_number, block))
    return entries


class DocumentAIProvider:
    name = "documentai"

    def available(self) -> bool:
        if not _configured("layout"):
            return False
        try:
            import google.cloud.documentai  # noqa: F401

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
            import io

            parent = getattr(pdf_page, "parent", None)
            use_pdf = os.environ.get("DOCAI_MODE", "image").strip().lower() == "pdf" and parent is not None
            if use_pdf:
                cache_key = id(parent)
                doc = _document_cache.get(cache_key)
                if doc is None:
                    doc = process_document_with_docai(parent.tobytes(), "application/pdf", "layout")
                    _document_cache[cache_key] = doc
            else:
                buf = io.BytesIO()
                page_image.save(buf, format="PNG")
                doc = process_document_with_docai(buf.getvalue(), "image/png", "layout")
            logger.info(
                "Google Document AI layout response: pages=%d document_layout_blocks=%d",
                len(getattr(doc, "pages", None) or []),
                len(getattr(getattr(doc, "document_layout", None), "blocks", None) or []),
            )
        except DocumentAIProviderError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("Google Document AI layout failed on page %s: %s", page_number, type(exc).__name__)
            raise DocumentAIProviderError(
                f"Google Document AI layout processor failed: {type(exc).__name__}"
            ) from exc

        width, height = float(page_image.width), float(page_image.height)
        regions: list[Region] = []
        for _detected_page_number, block in _page_blocks(doc, page_number):
            # DocAI returns reading order already; keep it.
            layout = getattr(block, "layout", None)
            payload = None
            block_kind = ""
            if layout is None:
                # Layout Parser uses Document.document_layout.blocks. Those
                # blocks carry a bounding_box and a oneof payload instead of
                # the OCR Page.Layout shape.
                bounding_poly = getattr(block, "bounding_box", None)
                try:
                    block_kind = block._pb.WhichOneof("block")
                    payload = getattr(block, block_kind, None)
                except Exception:  # noqa: BLE001
                    block_kind = ""
            else:
                bounding_poly = getattr(layout, "bounding_poly", None)
            normalized_vertices = getattr(bounding_poly, "normalized_vertices", []) or []
            vertices = normalized_vertices or (getattr(bounding_poly, "vertices", []) or [])
            normalized = bool(normalized_vertices)
            vert = vertices
            if len(vert) < 2:
                continue
            scale_x = width if normalized else 1.0
            scale_y = height if normalized else 1.0
            xs = [float(v.x) * scale_x for v in vert]
            ys = [float(v.y) * scale_y for v in vert]
            bbox: BBox = clamp_bbox(
                (min(xs), min(ys), max(xs), max(ys)), width, height
            )
            style_type = ""
            try:
                style_type = str(
                    getattr(layout, "type_", "")
                    or getattr(layout, "type", "")
                    or getattr(payload, "type_", "")
                    or {
                        "table_block": "TABLE",
                        "list_block": "LIST",
                        "image_block": "PICTURE",
                    }.get(block_kind, "")
                )
            except Exception:  # noqa: BLE001
                pass
            seg_index = 0
            try:
                seg_index = int(layout.text_anchor.text_segments[0].start_index or 0)
            except Exception:  # noqa: BLE001
                pass
            text = ""
            try:
                if payload is not None and block_kind == "text_block":
                    text = str(getattr(payload, "text", "") or "").strip()
                elif payload is not None and block_kind == "image_block":
                    text = str(getattr(payload, "image_text", "") or "").strip()
                elif payload is not None and block_kind == "table_block":
                    text = str(getattr(payload, "caption", "") or "").strip()
                elif layout is not None:
                    end = int(layout.text_anchor.text_segments[-1].end_index or seg_index)
                    text = (doc.text or "")[seg_index:end].strip()
            except Exception:  # noqa: BLE001
                text = ""
            conf = float(getattr(layout, "confidence", 0.9) or 0.9)
            style_key = style_type.upper()
            hint = _STYLE_MAP.get(
                style_key,
                "heading" if style_key.startswith("HEADING") else "unknown",
            )
            if block_kind == "table_block":
                hint = "table"
            elif block_kind == "list_block":
                hint = "list"
            elif block_kind == "image_block":
                hint = "image"
            if hint == "unknown" and text:
                hint = "paragraph"
            regions.append(
                Region(
                    bbox=bbox,
                    type_hint=hint,
                    confidence=max(0.3, min(1.0, conf)),
                    source=self.name,
                    text=text,
                    meta={"style_type": style_type, "page": _detected_page_number},
                )
            )
        return regions


def documentai_ocr_available() -> bool:
    """DocAI doubles as the primary OCR engine when configured."""
    if not _configured("ocr"):
        return False
    try:
        import google.cloud.documentai  # noqa: F401

        return True
    except Exception:  # noqa: BLE001
        return False


__all__ = [
    "DocumentAIProvider",
    "DocumentAIProviderError",
    "RENDER_DPI",
    "configuration_error",
    "clear_document_cache",
    "documentai_ocr_available",
    "process_document_with_docai",
]
