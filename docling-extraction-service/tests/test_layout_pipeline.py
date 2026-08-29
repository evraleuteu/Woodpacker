"""Tests for the deterministic layout-first pipeline (rebuild spec).

Covers every stage node + the LangGraph end-to-end run + the legacy adapter.
All LLM/network paths are disabled so results are fully deterministic.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parent.parent / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from woodpacker_extraction.layout import classify as classify_mod  # noqa: E402
from woodpacker_extraction.layout import exercises as ex_mod  # noqa: E402
from woodpacker_extraction.layout import knowledge_graph  # noqa: E402
from woodpacker_extraction.layout import reading_order  # noqa: E402
from woodpacker_extraction.layout import relationships as rel_mod  # noqa: E402
from woodpacker_extraction.layout.crops import build_blocks_from_regions, load_pdf_pages  # noqa: E402
from woodpacker_extraction.layout.pipeline import bundle_flashcards, to_legacy_result  # noqa: E402
from woodpacker_extraction.layout.providers import Region, resolve_provider_for_page  # noqa: E402
from woodpacker_extraction.layout.types import (  # noqa: E402
    AudioReference,
    DocumentBundle,
    LayoutBlock,
    VALID_BLOCK_TYPES,
)
from woodpacker_extraction.layout.graph import run_layout_pipeline  # noqa: E402
from woodpacker_extraction.layout.pipeline import run_layout_analysis  # noqa: E402


@pytest.fixture(autouse=True)
def _offline_deterministic(monkeypatch, tmp_path):
    """No LLM, no MinIO, artifacts into tmp — deterministic & hermetic."""
    for var in (
        "OPENCODE_API_KEY",
        "MINIO_ENDPOINT",
        "GOOGLE_APPLICATION_CREDENTIALS",
        "GOOGLE_CLOUD_PROJECT",
        "DOCAI_OCR_PROCESSOR_ID",
        "DOCAI_LAYOUT_PROCESSOR_ID",
        "DOCAI_MODE",
        "LAYOUT_FORCE_PROVIDER",
    ):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("ARTIFACTS_DIR", str(tmp_path / "artifacts"))
    yield


# ---------------------------------------------------------------------------
# Stage 1: PDF loader
# ---------------------------------------------------------------------------


def test_pdf_loader_renders_pages_with_dimensions(digital_pdf):
    pages, images, all_digital = load_pdf_pages(digital_pdf)
    assert len(pages) == 3
    assert all_digital is True
    for page in pages:
        assert page.width > 0 and page.height > 0
        assert images[page.page].size == (page.width, page.height)
        assert page.has_text_layer is True


# ---------------------------------------------------------------------------
# Stage 2: Layout detection — coordinates mandatory
# ---------------------------------------------------------------------------


def test_every_block_has_coordinates_and_valid_type(digital_pdf):
    bundle = run_layout_pipeline(digital_pdf, file_id="t1")
    blocks = bundle.all_blocks()
    assert len(blocks) >= 3
    for b in blocks:
        assert len(b.bbox) == 4
        assert b.bbox[0] < b.bbox[2] and b.bbox[1] < b.bbox[3]
        assert b.type in VALID_BLOCK_TYPES
        assert 0.0 <= b.confidence <= 1.0
        assert b.block_id.startswith(f"page_{b.page:03d}_block_")


def test_provider_resolution_prefers_pymupdf_for_text_layer():
    name, provider = resolve_provider_for_page(has_text_layer=True)
    assert name == "pymupdf"
    assert provider is not None


def test_unknown_providers_are_skipped(monkeypatch):
    monkeypatch.setenv("LAYOUT_PROVIDER_ORDER", "does_not_exist,surya")
    name, provider = resolve_provider_for_page(has_text_layer=False)
    assert name == "surya"  # installed in this venv


# ---------------------------------------------------------------------------
# Reading order
# ---------------------------------------------------------------------------


def _block(bid, page, bbox):
    return LayoutBlock(block_id=bid, page=page, type="paragraph", bbox=bbox, confidence=0.9)


def test_reading_order_single_column_top_to_bottom():
    blocks = [
        _block("c", 1, (50.0, 400.0, 500.0, 460.0)),
        _block("a", 1, (50.0, 100.0, 500.0, 160.0)),
        _block("b", 1, (50.0, 250.0, 500.0, 310.0)),
    ]
    ordered = reading_order.order_page_blocks(blocks, 600.0)
    assert [b.block_id for b in ordered] == ["a", "b", "c"]


def test_reading_order_two_columns_left_first():
    left_top = _block("lt", 1, (40.0, 100.0, 280.0, 200.0))
    left_bottom = _block("lb", 1, (40.0, 300.0, 280.0, 400.0))
    right_top = _block("rt", 1, (320.0, 100.0, 560.0, 200.0))
    right_bottom = _block("rb", 1, (320.0, 300.0, 560.0, 400.0))
    ordered = reading_order.order_page_blocks([right_top, right_bottom, left_top, left_bottom], 600.0)
    assert [b.block_id for b in ordered] == ["lt", "lb", "rt", "rb"]


# ---------------------------------------------------------------------------
# Stage 5: Rules-first classification
# ---------------------------------------------------------------------------


def _cls(text: str) -> str:
    block = LayoutBlock(
        block_id="page_001_block_000", page=1, type="paragraph",
        bbox=(80.0, 300.0, 500.0, 380.0), confidence=0.95, text=text,
    )
    classification = classify_mod._classify_one(block, 1200.0, text)
    return classification.category


def test_spec_rule_numbered_items_suggest_question():
    assert _cls("1. Ich _____ (arbeiten) seit fünf Jahren hier.") == "question"


def test_spec_rule_listening_cue():
    assert _cls("Hören Sie Track 12.") == "reference"


def test_spec_rule_matching_cues_classify_exercise():
    assert _cls("Ordnen Sie zu.") == "exercise"
    assert _cls("Verbinden Sie die Sätze.") == "exercise"


def test_imperative_instruction_vs_exercise():
    assert _cls("Kreuzen Sie an.") == "instruction"
    assert _cls("Aufgabe 5: Ergänzen Sie die Lücken.\n1. Ich ___ (kommen).") == "exercise"


def test_geometry_header_footer_page_number():
    header = LayoutBlock(
        block_id="page_001_block_000", page=1, type="paragraph",
        bbox=(80.0, 10.0, 500.0, 40.0), confidence=0.9, text="Schritte International",
    )
    pagenum = LayoutBlock(
        block_id="page_001_block_001", page=1, type="paragraph",
        bbox=(300.0, 1160.0, 340.0, 1190.0), confidence=0.9, text="7",
    )
    assert classify_mod._classify_one(header, 1200.0, header.text).category == "header"
    result = classify_mod._classify_one(pagenum, 1200.0, pagenum.text)
    assert result.category == "footer"
    assert "rule:page_number" in result.signals


# ---------------------------------------------------------------------------
# Stage 9: Exercise typing + segmentation
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Ordnen Sie zu.\n1. der Bahnhof\n2. die Fahrkarte\nA. Bahnhof", "matching"),
        ("Hören Sie den Dialog zu Track 3.", "listening"),
        ("Setzen Sie das richtige Verb ein.\n1. Ich _____ (fahren).", "fill_blank"),
        ("Kreuzen Sie an:\na) Ich bin Student.\nb) Er studiert.", "multiple_choice"),
        ("Richtig oder falsch?\n1. Der Kurs beginnt um neun.", "true_false"),
        ("Lesen Sie den Text und antworten Sie.", "reading"),
    ],
)
def test_exercise_type_rules(text, expected):
    ex_type, conf = ex_mod.classify_exercise_type(text)
    assert ex_type == expected
    assert conf >= 0.45


def test_confidence_is_calibrated_higher_for_strong_signals():
    _, weak = ex_mod.classify_exercise_type("Was passt?")
    _, strong = ex_mod.classify_exercise_type(
        "Hören Sie den Text zu Track 4. Ergänzen Sie die Lücken:\n1. Ich _____ (wohnen) in Berlin."
    )
    assert strong > weak
    assert strong >= 0.6


def _segment_fixture_blocks() -> tuple[list[str], dict[str, LayoutBlock]]:
    defs = [
        ("i1", "instruction", (80.0, 150.0, 550.0, 190.0), "Aufgabe 1a: Ordnen Sie zu."),
        ("q1", "question", (80.0, 210.0, 550.0, 250.0), "1. der Bahnhof"),
        ("q2", "question", (80.0, 260.0, 550.0, 300.0), "2. die Fahrkarte"),
        ("img1", "image", (80.0, 310.0, 350.0, 520.0), ""),
        ("aud1", "audio_reference", (80.0, 530.0, 350.0, 570.0), "CD 1, Track 03"),
        ("p1", "paragraph", (80.0, 600.0, 550.0, 700.0), "Der Bahnhof ist groß und hell."),
    ]
    blocks_by_id = {
        bid: LayoutBlock(block_id=bid, page=25, type=t, bbox=bbox, confidence=0.95, text=text)
        for bid, t, bbox, text in defs
    }
    return [bid for bid, *_ in defs], blocks_by_id


def test_segment_groups_instruction_questions_image_audio():
    ids, blocks_by_id = _segment_fixture_blocks()
    audio_refs = [AudioReference(ref_id="track_3", track=3, cd=1, kind="audio", raw_text="CD 1, Track 03")]
    audio_refs[0].block_ids = ["aud1"]
    shells = ex_mod.segment_exercises(
        ids, blocks_by_id,
        file_id="doc1", filename="A1 Kursbuch.pdf", sha256="deadbeef",
        audio_refs=audio_refs,
    )
    assert len(shells) == 1
    shell = shells[0]
    assert shell.instruction_block == "i1"
    assert shell.question_blocks == ["q1", "q2"]
    assert shell.image_blocks == ["img1"]
    assert "track_3" in shell.audio_references
    assert shell.exercise_id.startswith("doc1_A1_25_")


def test_orphan_questions_still_form_an_exercise():
    ids = ["q1", "q2"]
    blocks_by_id = {
        "q1": LayoutBlock("q1", 2, "question", (80.0, 100.0, 500.0, 140.0), 0.9, "1. Wer kommt morgen?"),
        "q2": LayoutBlock("q2", 2, "question", (80.0, 150.0, 500.0, 190.0), 0.9, "2. Wann beginnt der Film?"),
    }
    shells = ex_mod.segment_exercises(
        ids, blocks_by_id, file_id="d2", filename="kursbuch_p2.pdf", sha256="ff", audio_refs=[],
    )
    assert len(shells) == 1
    assert shells[0].instruction_block is None
    assert shells[0].question_blocks == ["q1", "q2"]


# ---------------------------------------------------------------------------
# Stages 6/7/8: vision budget, relationships, knowledge graph
# ---------------------------------------------------------------------------


def test_vision_disabled_falls_back_deterministically(digital_pdf, monkeypatch):
    from woodpacker_extraction.layout.vision_images import understand_images

    pages, images, _ = load_pdf_pages(digital_pdf)
    image_block = LayoutBlock("page_001_block_099", 1, "image", (10.0, 10.0, 200.0, 200.0), 0.9)
    out, calls = understand_images([image_block], {"page_001_block_099": images[1].crop((10, 10, 200, 200))})
    assert calls == 0
    assert out[0].engine == "fallback"
    assert out[0].description == "Image on page 1"


def test_relationships_link_questions_images_audio():
    ids, blocks_by_id = _segment_fixture_blocks()
    audio_ref = AudioReference(ref_id="track_3", track=3, cd=1, kind="audio")
    audio_ref.block_ids = ["aud1"]
    shells = ex_mod.segment_exercises(
        ids, blocks_by_id, file_id="d3", filename="A1.pdf", sha256="aa", audio_refs=[audio_ref],
    )
    rels = rel_mod.build_relationships(shells, blocks_by_id, [audio_ref], ids)
    pairs = {(r.relationship, r.from_ref, r.to_ref) for r in rels}
    assert ("HAS_QUESTION", "i1", "q1") in pairs
    assert ("HAS_QUESTION", "i1", "q2") in pairs
    assert any(rel.relationship == "HAS_IMAGE" and rel.to_ref == "img1" for rel in rels)
    assert any(rel.to_ref == "track_3" and rel.relationship in ("HAS_AUDIO", "BELONGS_TO") for rel in rels)
    assert all(0.0 <= r.confidence <= 1.0 for r in rels)


def test_knowledge_graph_node_and_edge_types():
    ids, blocks_by_id = _segment_fixture_blocks()
    audio_ref = AudioReference(ref_id="track_3", track=3, cd=1, kind="audio")
    audio_ref.block_ids = ["aud1"]
    shells = ex_mod.segment_exercises(
        ids, blocks_by_id, file_id="d4", filename="A1.pdf", sha256="ab", audio_refs=[audio_ref],
    )
    bundle = DocumentBundle(file_id="d4", filename="A1.pdf", sha256="ab", page_count=1)
    bundle.exercises = shells
    bundle.audio_refs = [audio_ref]
    kg = knowledge_graph.build_graph(bundle, blocks_by_id)

    node_types = {n["type"] for n in kg["nodes"]}
    assert "Lesson" in node_types
    assert "Exercise" in node_types
    assert "Question" in node_types
    edge_types = {l["relationship"] for l in kg["links"]}
    assert "HAS_EXERCISE" in edge_types
    assert edge_types <= {"HAS_EXERCISE", "HAS_IMAGE", "HAS_AUDIO", "HAS_SOLUTION",
                          "RELATED_TO", "BELONGS_TO", "HAS_QUESTION"}
    lesson_node = next(n for n in kg["nodes"] if n["type"] == "Lesson")
    assert kg["links"][0]["source"] == lesson_node["id"] or any(
        l["source"] == lesson_node["id"] and l["relationship"] == "HAS_EXERCISE" for l in kg["links"]
    )


# ---------------------------------------------------------------------------
# End-to-end graph + storage determinism
# ---------------------------------------------------------------------------


def _strip_nondeterministic(bundle_dict: dict) -> dict:
    """Remove wall-clock / temp-path fields before determinism comparison."""
    import copy
    data = copy.deepcopy(bundle_dict)
    # Telemetry timings and job-specific root paths are non-deterministic.
    for entry in data.get("telemetry") or []:
        entry.pop("duration_ms", None)
        entry.pop("started_at", None)
    # Artifact paths embed the pytest tmp dir — compare only block ids.
    artifacts = data.get("artifacts")
    if isinstance(artifacts, dict):
        artifacts.pop("local_root", None)
    return data


def test_end_to_end_deterministic_with_artifacts(digital_pdf):
    bundle_a = run_layout_pipeline(digital_pdf, file_id="e2e", job_id="run-a")
    bundle_b = run_layout_pipeline(digital_pdf, file_id="e2e", job_id="run-b")
    assert _strip_nondeterministic(bundle_a.to_dict()) == _strip_nondeterministic(bundle_b.to_dict()), \
        "pipeline semantic output must be deterministic across runs"

    assert bundle_a.page_count == 3
    assert bundle_a.reading_order
    exercises = bundle_a.exercises
    assert exercises, "fixture PDF contains Aufgaben"
    for ex in exercises:
        from woodpacker_extraction.layout.types import VALID_EXERCISE_TYPES

        assert ex.exercise_type in VALID_EXERCISE_TYPES
        assert 0.0 <= ex.type_confidence <= 1.0
        assert ex.instruction_block or ex.question_blocks
    types = {ex.exercise_type for ex in exercises}
    assert "matching" in types or "multiple_choice" in types or "fill_blank" in types

    telemetry_nodes = [t["node"] for t in bundle_a.telemetry]
    assert telemetry_nodes == [
        "pdf_loader", "layout_detection", "block_extraction", "ocr",
        "classification", "relationships", "knowledge_graph",
        "exercise_detection", "storage",
    ]
    for entry in bundle_a.telemetry:
        assert entry["status"] == "ok"
        assert entry["duration_ms"] >= 0
        assert "confidence" in entry

    artifacts_root = Path(os.environ["ARTIFACTS_DIR"]) / "e2e"
    doc_json = artifacts_root / "document.json"
    assert doc_json.exists()
    stored = json.loads(doc_json.read_text(encoding="utf-8"))
    assert stored["pages"] and stored["exercises"] == [e.to_dict() for e in bundle_a.exercises]
    assert any(artifacts_root.glob("pages/page_*.png"))
    assert any(artifacts_root.glob("blocks/*.png"))


def test_scanned_page_resolution_uses_ocr_layout_provider(monkeypatch):
    """Textless pages must NOT use pymupdf native; provider chain engages."""
    name, _provider = resolve_provider_for_page(has_text_layer=False)
    assert name in ("documentai", "paddle_structure", "surya")


# ---------------------------------------------------------------------------
# Legacy adapter contracts
# ---------------------------------------------------------------------------


def test_legacy_adapter_shapes(digital_pdf):
    from woodpacker_extraction.layout.pipeline import run_layout_analysis, to_legacy_result as to_legacy

    bundle = run_layout_analysis(digital_pdf, file_id="leg", filename="A1 Kursbuch.pdf")
    legacy = to_legacy(bundle, filename="A1 Kursbuch.pdf")

    for key in ("exercises", "flashcards", "questions", "relationships",
                "knowledgeGraph", "quality", "telemetry", "layout_blocks"):
        assert key in legacy
    assert legacy["engine"] == "layout"
    assert legacy["extraction_mode"] == "layout-deterministic"

    if legacy["flashcards"]:
        card = legacy["flashcards"][0]
        assert {"id", "type", "prompt", "options", "source"} <= set(card)
        assert card["type"] in {"fill-blank", "multiple-choice", "translation", "recall",
                                "pattern-drill", "roleplay", "comprehension", "assessment"}

    kg = legacy["knowledgeGraph"]
    assert isinstance(kg.get("nodes"), list) and isinstance(kg.get("links"), list)
    for link in kg["links"]:
        assert {"from", "to", "type", "confidence"} <= set(link)

    for blk in legacy["layout_blocks"]:
        assert {"type", "text", "bbox", "page"} <= set(blk)
        assert len(blk["bbox"]) == 4


def test_bundle_flashcards_map_types_to_coarse_taxonomy(digital_pdf):
    bundle = run_layout_analysis(digital_pdf, file_id="fc", filename="A1.pdf")
    cards = bundle_flashcards(bundle, source_id="asset-1")
    valid = {"fill-blank", "multiple-choice", "translation", "recall",
             "pattern-drill", "roleplay", "comprehension", "assessment"}
    assert cards, "expected flashcards from fixture exercises"
    for card in cards:
        assert card["type"] in valid
        assert card["prompt"].strip()
        assert card["source"] == "asset-1"


def test_build_blocks_from_regions_assigns_spec_style_ids(digital_pdf):
    pages, _images, _digital = load_pdf_pages(digital_pdf)
    region = Region(bbox=(10.0, 20.0, 110.0, 40.0), type_hint="title", confidence=0.99, source="pymupdf", text="Titel")
    build_blocks_from_regions({1: [region]}, pages)
    assert pages[0].blocks[0].block_id == "page_001_block_000"
