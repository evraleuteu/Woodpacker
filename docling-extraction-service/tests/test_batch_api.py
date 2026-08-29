"""Integration: /extract/batch parse-once flow + relationship merge (no LLM)."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from conftest import make_digital_pdf


@pytest.fixture(scope="module")
def client():
    # Force heuristic mode for deterministic, offline tests.
    import os

    os.environ.pop("OPENCODE_API_KEY", None)
    os.environ["OPENCODE_API_KEY"] = ""
    from woodpacker_extraction.server import app

    with TestClient(app) as c:
        yield c


def _pdf_bytes(path):
    with open(path, "rb") as f:
        return f.read()


def test_batch_two_files_relationships_and_reports(tmp_path, client):
    kb = make_digital_pdf(
        tmp_path / "Kursbuch_Kapitel_3.pdf",
        pages={1: "Kapitel 3\nAufgabe 5: Ergänzen Sie die Sätze.\n1. Ich _____ (arbeiten)."},
        page_count=1,
    )
    ub = make_digital_pdf(
        tmp_path / "Uebungsbuch_Kapitel_3.pdf",
        pages={1: "Kapitel 3\nAufgabe 5: Ergänzen Sie die Sätze im Perfekt.\n1. Ich _____ (arbeiten)."},
        page_count=1,
    )

    res = client.post(
        "/extract/batch",
        files=[
            ("files", ("Kursbuch_Kapitel_3.pdf", _pdf_bytes(kb), "application/pdf")),
            ("files", ("Uebungsbuch_Kapitel_3.pdf", _pdf_bytes(ub), "application/pdf")),
        ],
        data={"engine": "graph", "require_answer": "false", "course_id": "course-1"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    result = body["result"]

    assert body["files"] == 2
    assert len(result["classifications"]) == 2
    assert len(result["flashcards"]) >= 2

    # Phase 10: cross-material exercise_number_match present exactly once per direction
    number_matches = [
        r for r in result.get("relationships", [])
        if r.get("relationship") == "exercise_number_match"
    ]
    assert len(number_matches) >= 1

    # material_links use the LessonMaterialLink shape the backend persists
    for link in result.get("material_links", []):
        assert set(link) >= {"from_exercise_id", "to_exercise_id", "relationship_type", "confidence"}

    # Phase 7/12/21: file reports carry explicit quality + telemetry
    reports = result["file_reports"]
    assert len(reports) == 2
    for report in reports:
        assert report["quality"]["total_pages"] == 1
        assert isinstance(report["quality"]["issues"], list)

    # Every flashcard carries a stable key + source attribution
    for fc in result["flashcards"]:
        assert fc.get("stable_key")
        assert fc.get("source") in ("file-0", "file-1")


def test_batch_rejects_bad_media_inventory(tmp_path, client):
    path = make_digital_pdf(tmp_path / "x.pdf", pages={1: "Aufgabe 1: Was passt?"}, page_count=1)
    res = client.post(
        "/extract/batch",
        files=[("files", ("x.pdf", _pdf_bytes(path), "application/pdf"))],
        data={"media_inventory": "not-json"},
    )
    assert res.status_code == 400


def test_extract_object_rejects_outside_prefixes(client):
    res = client.post(
        "/extract/object",
        json={"object_key": "../../etc/passwd"},
    )
    assert res.status_code == 403
