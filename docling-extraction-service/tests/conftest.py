"""Shared fixtures: synthetic PDFs covering the Phase 23 test matrix."""

from __future__ import annotations

import pymupdf
import pytest


def make_digital_pdf(path, pages: dict[int, str] | None = None, page_count: int = 3):
    """Digital PDF with a real text layer."""
    doc = pymupdf.open()
    texts = pages or {}
    for i in range(page_count):
        page = doc.new_page()
        text = texts.get(i + 1)
        if text:
            page.insert_text((72, 100), text, fontsize=11)
    doc.save(str(path))
    doc.close()
    return str(path)


def make_image_only_pdf(path, page_count: int = 3):
    """Scanned-book simulation: pages contain NO extractable text."""
    doc = pymupdf.open()
    for _ in range(page_count):
        page = doc.new_page()
        # Draw a rectangle so the page isn't degenerate, but add no text.
        page.draw_rect(pymupdf.Rect(50, 50, 300, 200))
    doc.save(str(path))
    doc.close()
    return str(path)


def make_hybrid_pdf(path):
    """Digital body with a scanned cover/TOC (pages 1-2 image-only)."""
    doc = pymupdf.open()
    for i in range(6):
        page = doc.new_page()
        if i >= 2:
            page.insert_text(
                (72, 100),
                f"Kapitel {i - 1}: Arbeit und Beruf\nAufgabe {i - 1}a: Ergänzen Sie die Sätze.\n1. Ich _____ (arbeiten) seit fünf Jahren hier.",
                fontsize=11,
            )
    doc.save(str(path))
    doc.close()
    return str(path)


@pytest.fixture
def digital_pdf(tmp_path):
    return make_digital_pdf(
        tmp_path / "digital.pdf",
        pages={
            1: "Kapitel 1: Reise und Verkehr\n\nAufgabe 1a: Kreuzen Sie an.\na) Ich _____ (fahren) mit dem Bus.\nb) Wir _____ (gehen) zu Fuß.",
            2: "Aufgabe 1b: Ordnen Sie zu.\n1. der Bahnhof\n2. die Fahrkarte\n3. das Gleis",
            3: "Aufgabe 2: Was passt?\n1. Ich möchte einen Kaffee.\n2. Herr Braun, können Sie das wiederholen?",
        },
        page_count=3,
    )


@pytest.fixture
def scanned_pdf(tmp_path):
    return make_image_only_pdf(tmp_path / "scanned.pdf", page_count=4)


@pytest.fixture
def hybrid_pdf(tmp_path):
    return make_hybrid_pdf(tmp_path / "hybrid.pdf")
