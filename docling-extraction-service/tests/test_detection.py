"""Phase 3/8: scanned detection + German imperative exercise detection."""

from __future__ import annotations

from conftest import make_digital_pdf, make_hybrid_pdf, make_image_only_pdf

from woodpacker_extraction.extractor import (
    detect_exercises,
    is_scanned_pdf,
    scan_profile,
)


class TestScannedDetection:
    def test_digital_pdf_not_scanned(self, digital_pdf):
        assert is_scanned_pdf(digital_pdf) is False

    def test_image_only_pdf_is_scanned(self, scanned_pdf):
        profile = scan_profile(scanned_pdf)
        assert profile["is_scanned"] is True
        assert profile["scanned_ratio"] == 1.0

    def test_hybrid_pdf_classified_by_body_not_cover(self, tmp_path):
        """A scanned cover/TOC must NOT classify the whole book as scanned."""
        path = make_hybrid_pdf(tmp_path / "hybrid.pdf")
        profile = scan_profile(path)
        # 4 of 6 pages have text → ratio 0.333 < 0.5 → NOT scanned
        assert profile["is_scanned"] is False
        assert profile["pages_with_text"] == 4

    def test_sampling_spreads_across_document(self, tmp_path):
        """Sampling must reach the END of large documents (old bug: first 5 only)."""
        texts = {i: f"Kapitel {i}: Inhalt Seite {i}" for i in range(1, 101)}
        path = make_digital_pdf(tmp_path / "big.pdf", pages=texts, page_count=100)
        profile = scan_profile(path)
        assert profile["sampled_pages"] <= 12
        assert profile["is_scanned"] is False

    def test_majority_scanned_large_doc(self, tmp_path):
        """100-page doc where only the first 5 pages have text IS scanned."""
        doc_pages = {i: f"Text {i}" for i in range(1, 6)}
        path = make_digital_pdf(tmp_path / "mostly_scanned.pdf", pages=doc_pages, page_count=100)
        assert is_scanned_pdf(path) is True


class TestGermanImperativeDetection:
    def test_kreuzen_sie_an_without_question_mark(self):
        text = (
            "[PAGE 1]\nAufgabe 5a: Kreuzen Sie an.\na) Ich _____ (fahren) mit dem Bus.\nb) Du _____ (kommen) spät."
        )
        exercises = detect_exercises(text)
        assert len(exercises) >= 1
        assert any("Kreuzen Sie an" in e["prompt"] for e in exercises)

    def test_ergaenzen_sie(self):
        text = "[PAGE 2]\nÜbung 3: Ergänzen Sie.\n1. Wir _____ (lernen) Deutsch."
        exercises = detect_exercises(text)
        assert any("Ergänzen Sie" in e["prompt"] for e in exercises)

    def test_ordnen_sie_zu(self):
        text = "[PAGE 3]\nAufgabe 7: Ordnen Sie zu.\n1. der Bahnhof\n2. die Fahrkarte"
        exercises = detect_exercises(text)
        assert any("Ordnen Sie zu" in e["prompt"] for e in exercises)

    def test_was_passt(self):
        text = "[PAGE 4]\nWas passt?\n1. Ich möchte einen Kaffee."
        exercises = detect_exercises(text)
        assert len(exercises) >= 1

    def test_track_listings_rejected(self):
        text = "[PAGE 5]\nCD 1, Track 3\n1.07\nSpur 5\n› 20\nA1\nAufgabe 1: Ergänzen Sie.\n1. Ich _____ (sein) müde."
        exercises = detect_exercises(text)
        assert all("Track 3" not in e["prompt"] for e in exercises)
        assert all("1.07" not in e["prompt"].split("\n")[0] for e in exercises)

    def test_multipage_exercise_keeps_page_range(self):
        text = (
            "[PAGE 10]\nAufgabe 12: Lesen Sie den Text und lösen Sie die Aufgaben.\n"
            "1. Wo arbeitet Frau Klein?\n"
            "[PAGE 11]\n"
            "2. Was macht sie am Wochenende?"
        )
        exercises = detect_exercises(text)
        assert exercises, "multi-page exercise must be captured"
        page = exercises[0]["page"]
        assert page is not None and "10" in str(page)


class TestHybridPdfParsing:
    def test_hybrid_text_extraction_skips_blank_pages(self, hybrid_pdf):
        from woodpacker_extraction.assets import build_document_asset

        asset = build_document_asset(hybrid_pdf, "hybrid-1")
        assert asset.metadata["is_scanned"] is False
        # Pages 1-2 are image-only; pages 3+ carry text.
        assert [n for n, _ in asset.pages] == [3, 4, 5, 6]
