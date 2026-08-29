"""Interchangeable layout detection providers.

Priority (env ``LAYOUT_PROVIDER_ORDER``, default ``documentai,paddle_structure,surya``):

1. Google Document AI      — primary when GCP credentials are configured
2. PaddleOCR PP-Structure  — fallback when paddleocr is installed
3. Surya LayoutPredictor   — last-resort OCR-based layout (installed offline)

A fourth always-available provider, **pymupdf**, is used FIRST for pages that
already carry a digital text layer: for digital PDFs the embedded text layer
with exact coordinates IS the ground truth and keeps output fully
deterministic. The OCR-based providers engage only for scanned/textless pages.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any, Protocol

from ..types import BBox

logger = logging.getLogger(__name__)


@dataclass
class Region:
    """A raw detected region in PIXEL coordinates of the rendered page."""

    bbox: BBox
    type_hint: str  # one of layout.types BLOCK_TYPES
    confidence: float
    source: str
    text: str = ""
    spans: list[dict[str, Any]] = field(default_factory=list)  # TextSpan.to_dict()
    meta: dict[str, Any] = field(default_factory=dict)


class LayoutProvider(Protocol):
    name: str

    def available(self) -> bool: ...

    def detect_page(
        self,
        page_image: Any,  # PIL.Image
        page_number: int,
        pdf_page: Any | None = None,  # pymupdf.Page when available
    ) -> list[Region]: ...


def provider_order() -> list[str]:
    """Configured OCR-layout provider order (digital pages always use pymupdf)."""
    raw = os.environ.get("LAYOUT_PROVIDER_ORDER", "documentai,paddle_structure,surya")
    return [p.strip() for p in raw.split(",") if p.strip()]


def get_provider(name: str) -> LayoutProvider | None:
    """Return an instantiated provider by registry name (None if unknown)."""
    if name == "documentai":
        from .documentai import DocumentAIProvider

        return DocumentAIProvider()
    if name == "paddle_structure":
        from .paddle_structure import PaddleStructureProvider

        return PaddleStructureProvider()
    if name == "surya":
        from .surya_layout import SuryaLayoutProvider

        return SuryaLayoutProvider()
    if name == "pymupdf":
        from .pymupdf_native import PyMuPDFProvider

        return PyMuPDFProvider()
    return None


def resolve_provider_for_page(has_text_layer: bool) -> tuple[str, LayoutProvider | None]:
    """Pick the provider for one page.

    When LAYOUT_FORCE_PROVIDER is set (benchmark mode), it takes absolute
    precedence — even over digital text layers — and must NOT silently fall
    back. If the forced provider is not available, return (forced, None) so
    the caller can surface a clear error (e.g. Google Doc AI not configured).
    Without a forced provider: digital text layer -> pymupdf native
    (deterministic). Scanned pages -> first available provider in
    LAYOUT_PROVIDER_ORDER, else pymupdf native as final safety net.
    """
    forced = os.environ.get("LAYOUT_FORCE_PROVIDER", "").strip()
    if forced:
        provider = get_provider(forced)
        if provider is None:
            logger.warning("LAYOUT_FORCE_PROVIDER=%s is unknown", forced)
            return forced, None
        if not provider.available():
            logger.warning("LAYOUT_FORCE_PROVIDER=%s not available (missing deps/config)", forced)
            return forced, None
        return forced, provider
    if has_text_layer:
        provider = get_provider("pymupdf")
        if provider and provider.available():
            return "pymupdf", provider
    order = provider_order()
    for name in order:
        provider = get_provider(name)
        if provider is None or not provider.available():
            continue
        return name, provider
    fallback = get_provider("pymupdf")
    if fallback and fallback.available():
        return "pymupdf", fallback
    return "none", None


__all__ = ["LayoutProvider", "Region", "get_provider", "provider_order", "resolve_provider_for_page"]
