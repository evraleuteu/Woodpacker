"""Tests for the re-done exercise extraction (validation + extraction modules).

Run from the repo root::

    .venv\\Scripts\\python -m pytest tests -q
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from woodpacker_extraction.exercises import (  # noqa: E402
    heuristic_extract_exercises,
    map_flashcard_type,
)
from woodpacker_extraction.validation import (  # noqa: E402
    is_junk_exercise_prompt,
    normalize,
    parse_page_refs,
    strip_markdown,
    validate_extracted_exercise,
)


# ---------------------------------------------------------------------------
# Junk prompt gates (validation_rules.md)
# ---------------------------------------------------------------------------

JUNK_PROMPTS = [
    "1.07",
    "CD 1, Track 3",
    "Spur 5",
    "1 1.07 2 3 4 5",
    "› 20",
    "B2",
    "LERNWORTSCHATZ",
    "",
    "1234 56 78",
]


def test_junk_prompts_rejected():
    for prompt in JUNK_PROMPTS:
        result = validate_extracted_exercise({"type": "assessment", "prompt": prompt})
        assert not result.valid, f"expected rejection for {prompt!r}"


def test_is_junk_exercise_prompt_direct():
    assert is_junk_exercise_prompt("1 1.07 2 3 4 5")
    assert is_junk_exercise_prompt("CD 1, Track 3")
    assert is_junk_exercise_prompt("› 20")
    assert is_junk_exercise_prompt("1234 56 78")
    assert not is_junk_exercise_prompt("Ergänzen Sie die Sätze.")


# ---------------------------------------------------------------------------
# Type / prompt / reference gates
# ---------------------------------------------------------------------------


def test_invalid_type_rejected():
    result = validate_extracted_exercise({"type": "cooking", "prompt": "Was passt?"})
    assert not result.valid
    assert result.reasons[0].startswith("invalid-type:")


def test_valid_fill_blank_ok():
    result = validate_extracted_exercise(
        {"type": "fill-blank", "prompt": "Er _____ nach Berlin.", "page": "S. 12", "name": "Übung 3b"}
    )
    assert result.valid
    assert result.exercise["page"] == "S. 12"
    assert result.exercise["name"] == "Übung 3b"


def test_missing_answer_required():
    result = validate_extracted_exercise(
        {"type": "fill-blank", "prompt": "Er _____ nach Berlin."}, require_answer=True
    )
    assert not result.valid
    assert "missing-answer" in result.reasons


def test_track_number_name_rejected():
    result = validate_extracted_exercise(
        {"type": "assessment", "prompt": "Was ist richtig?", "name": "1.07"}
    )
    assert not result.valid
    assert "track-number-name" in result.reasons[0]


def test_page_without_number_rejected():
    result = validate_extracted_exercise(
        {"type": "assessment", "prompt": "Was ist richtig?", "page": "irgendwo"}
    )
    assert not result.valid
    assert "page-without-number" in result.reasons


def test_contains_page_marker_rejected():
    result = validate_extracted_exercise(
        {"type": "assessment", "prompt": "[PAGE 12] Was ist richtig?"}
    )
    assert not result.valid
    assert "contains-page-marker" in result.reasons


def test_all_caps_title_rejected():
    result = validate_extracted_exercise({"type": "assessment", "prompt": "VERKEHR UND MOBILITÄT"})
    assert not result.valid
    assert "all-caps-title" in result.reasons


def test_markdown_stripped():
    result = validate_extracted_exercise(
        {"type": "recall", "prompt": "**Was** ist `richtig`?", "answer": "__Berlin__"}
    )
    assert result.valid
    assert "**Was**" not in result.exercise["prompt"]
    assert "Berlin" in result.exercise["answer"]


# ---------------------------------------------------------------------------
# Multiple-choice integrity
# ---------------------------------------------------------------------------


def test_mc_answer_in_options():
    result = validate_extracted_exercise(
        {
            "type": "multiple-choice",
            "prompt": "Welche Antwort ist richtig?",
            "answer": "Berlin",
            "options": ["Berlin", "Paris", "Rom"],
        },
        require_answer=True,
    )
    assert result.valid
    assert result.exercise["answer"] == "Berlin"


def test_mc_answer_not_in_options_rejected():
    result = validate_extracted_exercise(
        {
            "type": "multiple-choice",
            "prompt": "Welche Antwort ist richtig?",
            "answer": "Madrid",
            "options": ["Berlin", "Paris", "Rom"],
        },
        require_answer=True,
    )
    assert not result.valid
    assert "answer-not-in-options" in result.reasons


def test_mc_duplicate_options_rejected():
    result = validate_extracted_exercise(
        {
            "type": "multiple-choice",
            "prompt": "Welche Antwort ist richtig?",
            "answer": "Berlin",
            "options": ["Berlin", "Berlin", "Berlin"],
        },
        require_answer=True,
    )
    assert not result.valid
    assert "duplicate-options" in result.reasons


def test_mc_prefix_answer_rewritten():
    result = validate_extracted_exercise(
        {
            "type": "multiple-choice",
            "prompt": "Welche Stadt?",
            "answer": "Ber",
            "options": ["Berlin", "Paris"],
        },
        require_answer=True,
    )
    assert result.valid
    assert result.exercise["answer"] == "Berlin"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def test_parse_page_refs():
    assert parse_page_refs("S. 24-26, 30") == [24, 25, 26, 30]
    assert parse_page_refs("A6") == [6]


def test_normalize():
    assert normalize("  a) Berlin ") == "berlin"
    assert normalize("  BERLIN ") == "berlin"


def test_strip_markdown():
    assert strip_markdown("**fett** und `code`") == "fett und code"
    assert strip_markdown("__unter__") == "unter"


# ---------------------------------------------------------------------------
# Heuristic extraction path (sample corpus)
# ---------------------------------------------------------------------------

SAMPLE_TEXT = """[PAGE 7]
Kapitel 1: Sie oder du?
CD 1, Track 3
1.07
Ergänzen Sie die Sätze.
1. Ich heiße _____ .
2. Das ist _____ .
Übung 2: Hören Sie Track 12 und beantworten Sie die Fragen.
1. Wo wohnt Lena?
2. Woher kommt sie?
B2
› 20
"""


def test_heuristic_extraction_keeps_only_real_exercises():
    # Post-migration API: returns (exercises, stats)
    exercises, stats = heuristic_extract_exercises(SAMPLE_TEXT)
    assert stats["mode"] == "heuristic"
    prompts = " ".join(e["prompt"] for e in exercises)
    assert "Ergänzen Sie" in prompts
    assert "Hören Sie Track 12" in prompts
    # Track listings, CEFR marker and page arrow never survive
    for junk in ["1.07", "CD 1", "B2", "› 20", "Sie oder du?"]:
        assert junk not in prompts


def test_map_flashcard_type():
    assert map_flashcard_type("fill_blank") == "fill-blank"
    assert map_flashcard_type("multiple_choice") == "multiple-choice"
    assert map_flashcard_type("listening") == "comprehension"
    assert map_flashcard_type("unknown_thing") == "assessment"