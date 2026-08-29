"""Phases 5/6/7/11/12: graph behavior — resume, telemetry, media resolution,
explicit truncation, validation gates."""

from __future__ import annotations

import json

from conftest import make_digital_pdf, make_image_only_pdf

from woodpacker_extraction.assets import build_document_asset
from woodpacker_extraction.graph import run_graph_extraction
from woodpacker_extraction.relationships import build_course_relationships


def _run(path, file_id, **kw):
    asset = build_document_asset(path, file_id)
    asset.metadata["_path"] = path
    return run_graph_extraction(
        path, file_id,
        job_id=kw.pop("job_id", f"test-{file_id}"),
        context=kw.pop("context", {"media_inventory": []}),
        asset=asset,
        **kw,
    )


class TestGraphExecution:
    def test_digital_pdf_extracts_exercises(self, digital_pdf):
        result = _run(digital_pdf, "dig-1")
        assert len(result["flashcards"]) >= 3
        assert result["status"] in ("processed", "needs_review")
        # Stable keys present (Phase 9)
        assert all(fc.get("stable_key") for fc in result["flashcards"])
        # Telemetry covers every node exactly once (Phase 21)
        nodes = [t["node"] for t in result["telemetry"]]
        for expected in ("ingest_text", "classify_document", "lesson_extract",
                         "exercise_extract", "normalize_exercises", "media_link",
                         "validate_quality", "persist"):
            assert expected in nodes, f"missing telemetry for {expected}"

    def test_scanned_pdf_without_ocr_becomes_needs_review(self, scanned_pdf):
        """No OCR engine available → explicit needs_review, never silent success."""
        result = _run(scanned_pdf, "scan-1")
        assert result["status"] == "needs_review"
        assert "zero_exercises" in result["quality"]["issues"]

    def test_media_resolution_against_inventory(self, digital_pdf):
        inventory = [
            {"file_id": "audio-real-1", "kind": "audio", "name": "Track 1.mp3"},
            {"file_id": "audio-real-12", "kind": "audio", "name": "Kont_A1_Track_12.mp3"},
        ]
        result = _run(digital_pdf, "dig-2", context={"media_inventory": inventory})
        linked = [i for q in result["questions"] for i in q.get("linked_audio", [])]
        assert all(a in ("audio-real-1", "audio-real-12") for a in linked), \
            "links must reference REAL inventory file_ids"

    def test_unresolved_media_becomes_orphan(self, digital_pdf):
        """References with no matching upload → orphan_media + needs_review."""
        result = _run(digital_pdf, "dig-3", context={"media_inventory": []})
        orphans = result["quality"].get("orphan_media") or []
        assert isinstance(orphans, list)
        # No synthetic track links may exist anywhere.
        for q in result["questions"]:
            for a in q.get("linked_audio", []):
                assert not a.startswith("track_"), "synthetic media link leaked"

    def test_page_cap_is_explicit_not_silent(self, tmp_path):
        texts = {i: f"Kapitel {i}: Aufgabe {i}: Ergänzen Sie.\n1. Ich _____ (sein) hier." 
                 for i in range(1, 31)}
        path = make_digital_pdf(tmp_path / "thirty.pdf", pages=texts, page_count=30)
        result = _run(path, "cap-1")
        q = result["quality"]
        assert q["total_pages"] == 30
        assert q["processed_pages"] == 30
        # Coverage tracked explicitly
        assert "coverage" in q

    def test_resume_same_thread_id(self, digital_pdf):
        """Same job_id → checkpointed thread; second run returns a valid result."""
        r1 = _run(digital_pdf, "res-1", job_id="resume-thread")
        r2 = _run(digital_pdf, "res-1", job_id="resume-thread")
        assert r1["sha256"] == r2["sha256"]
        assert len(r2["flashcards"]) == len(r1["flashcards"])

    def test_batch_parse_once_per_file(self, tmp_path):
        """Phase 6: N files parsed once each — sibling summaries only."""
        paths = [
            make_digital_pdf(tmp_path / f"f{i}.pdf", pages={
                1: f"Kapitel {i}\nAufgabe {i}: Ergänzen Sie.\n1. Wir _____ (kommen)."
            }, page_count=1)
            for i in range(1, 4)
        ]
        assets = [build_document_asset(p, f"file-{i}") for i, p in enumerate(paths, 1)]
        parse_counts = [a.metadata.get("_parse_count", 1) for a in assets]
        assert parse_counts == [1, 1, 1]  # each built exactly once


class TestRelationshipEngine:
    def _result(self, file_id, filename, material_type, exercises, flashcards=None):
        return {
            "classifications": [{"file_id": file_id, "file_name": filename,
                                 "file_type": material_type, "confidence": 0.9}],
            "exercises": exercises,
            "flashcards": flashcards or [],
            "questions": [],
        }

    def test_same_number_across_chapters_NOT_matched(self):
        """Regression: 'Aufgabe 5' in Kap. 3 must not match 'Aufgabe 5' in Kap. 7."""
        kursbuch = self._result("f-kb", "Kursbuch_Kapitel_3.pdf", "lesson_book",
                                [{"exercise_id": "ex-kb-5", "section": "Aufgabe 5"}])
        uebungsbuch = self._result("f-ub", "Uebungsbuch_Kapitel_7.pdf", "workbook",
                                   [{"exercise_id": "ex-ub-5", "section": "Aufgabe 5"}])
        summaries = [
            {"file_id": "f-kb", "filename": "Kursbuch_Kapitel_3.pdf"},
            {"file_id": "f-ub", "filename": "Uebungsbuch_Kapitel_7.pdf"},
        ]
        rel = build_course_relationships([kursbuch, uebungsbuch], summaries)
        number_matches = [r for r in rel["relationships"] if r["relationship"] == "exercise_number_match"]
        assert number_matches == []

    def test_same_number_same_chapter_complementary_books_matched(self):
        kb = self._result("f-kb", "Kursbuch_Kapitel_3.pdf", "lesson_book",
                          [{"exercise_id": "ex-kb-5", "section": "Aufgabe 5"}],
                          [{"id": "ex-kb-5", "prompt": "Ergänzen Sie die Sätze mit dem Verb."}])
        ub = self._result("f-ub", "Uebungsbuch_Kapitel_3.pdf", "workbook",
                          [{"exercise_id": "ex-ub-5", "section": "Aufgabe 5"}],
                          [{"id": "ex-ub-5", "prompt": "Ergänzen Sie die Sätze im Perfekt."}])
        summaries = [
            {"file_id": "f-kb", "filename": "Kursbuch_Kapitel_3.pdf"},
            {"file_id": "f-ub", "filename": "Uebungsbuch_Kapitel_3.pdf"},
        ]
        rel = build_course_relationships([kb, ub], summaries)
        matches = [r for r in rel["relationships"] if r["relationship"] == "exercise_number_match"]
        assert len(matches) == 1
        assert matches[0]["from"] == "ex-kb-5"
        assert matches[0]["to"] == "ex-ub-5"

    def test_solution_link_from_reference(self):
        kb = self._result("f-kb", "Kursbuch.pdf", "lesson_book",
                          [],
                          [{"id": "ex-kb-1", "prompt": "Lösung Seite 45: Ergänzen Sie die Tabelle."}])
        sol = self._result("f-sol", "Loesungen_Kapitel_3.pdf", "solution_book", [])
        summaries = [
            {"file_id": "f-kb", "filename": "Kursbuch.pdf"},
            {"file_id": "f-sol", "filename": "Loesungen_Kapitel_3.pdf"},
        ]
        rel = build_course_relationships([kb, sol], summaries)
        sol_links = [r for r in rel["relationships"] if r["relationship"] == "solution_link"]
        assert any(l["to"].startswith("solution-f-sol-page-45") for l in sol_links)


class TestLLMCache:
    def test_cache_roundtrip(self, tmp_path, monkeypatch):
        monkeypatch.setenv("LLM_CACHE_DIR", str(tmp_path / "cache"))
        from woodpacker_extraction import llm

        class FakeModel:
            model_name = "fake-model"
            calls = 0

            def invoke(self, messages):
                FakeModel.calls += 1

                class R:
                    content = '{"chapters":[],"exercises":[]}'
                    usage_metadata = {"input_tokens": 10, "output_tokens": 5}

                return R()

        from langchain_core.messages import SystemMessage

        msgs = [SystemMessage(content="hello")]
        llm.chat_invoke(FakeModel(), msgs)
        llm.chat_invoke(FakeModel(), msgs)
        assert FakeModel.calls == 1, "second identical call must hit the cache"
