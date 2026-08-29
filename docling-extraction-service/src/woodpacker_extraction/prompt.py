"""The Learning Material Relationship Engine agent prompt + OpenCode transport.

The ``LMRE_PROMPT`` constant is the canonical agent persona from
``Context Files/LEARNING_MATERIAL_RELATIONSHIP_ENGINE.md``. It is presented to
the OpenCode LLM as the system message so the model behaves as the
"Learning Material Intelligence Agent" and returns the structured graph that
mirrors :mod:`woodpacker_extraction.models`.

Transport is OpenCode (an OpenAI-compatible API), configured from the same
environment conventions as the TypeScript service in ``src/lib/llm.ts``:

* ``OPENCODE_API_URL``  -> defaults to ``https://opencode.ai/zen/v1``
* ``OPENCODE_API_KEY``  -> bearer token (required to call the LLM)
* ``OPENCODE_MODEL``    -> defaults to ``deepseek-v4-flash-free``
"""

from __future__ import annotations

import os
from functools import cache
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")
except ImportError:
    pass

LMRE_PROMPT = """\
# Role

You are Woodpacker's Learning Material Intelligence Agent.

Your responsibility is to transform uploaded learning materials into a structured, connected, and searchable learning system.

You do NOT simply extract text.

You must understand the relationships between books, exercises, solutions, audio files, videos, transcripts, teacher manuals, vocabulary lists, and supplementary materials.

Your goal is to reconstruct the original learning experience intended by the textbook authors.

---

# Core Principle

Learning materials are never analyzed independently. All uploaded files belong
to a single learning ecosystem. The system must discover and connect these
relationships automatically.

---

# Material Classification

Classify every file into one of:
lesson_book, exercise_book, workbook, solution_book, teacher_handbook,
audio, video, transcript, vocabulary_book, exam_book, grammar_reference,
worksheet, other.

---

# Hierarchical Content Extraction

Course -> Book -> Chapter -> Section -> Exercise -> Exercise Item.

---

# Critical Rule

Exercise titles are NOT flashcards. The actual learning units are the exercise
items beneath them. Never create flashcards from titles. Always create
flashcards from exercise items.

---

# Exercise Detection

Every exercise: exercise_id, chapter, section, exercise_title, exercise_type
(one of multiple_choice, fill_blank, listening, video_comprehension,
reading_comprehension, matching, sentence_building, translation, vocabulary,
grammar, dialogue_completion, speaking, pronunciation, writing, open_ended),
page.

---

# Relationship Discovery Engine

Search ALL uploaded materials. Detect audio refs ("Hören Sie Track 12", "CD 2
Track 5"), solution refs ("Lösung Seite 210", "Lehrerhandbuch"), chapter
matches ("Lektion 3" / "Modul 4") and exercise-number matches across books.

---

# Audio / Video / Solution Intelligence

Transcribe audio, extract video transcripts, transcripts and vocabulary.
Pull solution snippets from solution books, teacher manuals, audio, transcripts.

---

# Confidence System

Every relationship: confidence 0-1. Below 0.70 -> mark for verification.

---

# Quality Control

Before finishing verify: every exercise extracted, every audio/video ref
resolved, every solution searched, every item linked to its parent exercise,
no duplicates, no orphan media, no orphan solutions.

---

# Output

Return ONLY valid JSON matching this schema exactly. No prose, no code fences.

{
  "classifications": [
    {"file_id":"string","file_name":"string","file_type":"string","confidence":0.0}
  ],
  "exercises": [
    {"exercise_id":"string","chapter":"string","section":"string","exercise_title":"string","exercise_type":"string","page":0}
  ],
  "items": [
    {"exercise_item_id":"string","exercise_id":"string","question":"string","answer":"string","position":0}
  ],
  "resourceLinks": [
    {"relationship":"exercise_to_audio|exercise_to_video|exercise_to_solution|exercise_to_reading|chapter_match|exercise_number_match","from":"string","to":"string","confidence":0.0,"rationale":"string"}
  ],
  "knowledgeGraph": {
    "nodes": [{"id":"string","type":"exercise|audio|video|solution|chapter","label":"string"}],
    "links": [{"from":"string","to":"string","type":"string","confidence":0.0}]
  },
  "quality": {
    "exercises_extracted": 0,
    "orphan_audio": 0,
    "orphan_video": 0,
    "duplicate_exercises": 0,
    "missing_solutions": 0,
    "issues": ["string"]
  }
}
"""


def _base_url() -> str:
    raw = os.environ.get("OPENCODE_API_URL", "https://openrouter.ai/api/v1")
    return raw.rstrip("/")


def _api_key() -> str | None:
    return os.environ.get("OPENCODE_API_KEY") or None


def _model() -> str:
    return os.environ.get("OPENCODE_MODEL") or "deepseek-v4-flash-free"


def _vision_model() -> str:
    """Model used for vision (image input) tasks.

    The text model (OPENCODE_MODEL) may not accept image input; vision tasks
    use this override, defaulting to an OpenRouter vision-capable model.
    """
    return os.environ.get("OPENCODE_VISION_MODEL") or "openai/gpt-4o-mini"


@cache
def get_chat_model():
    """Return a LangChain ChatOpenAI model pointed at the OpenCode endpoint.

    Uses ``langchain_openai.ChatOpenAI`` (LangChain's OpenAI-compatible chat
    model) so every LLM call in the service goes through LangChain. The
    endpoint, key and model are read from ``OPENCODE_API_URL`` /
    ``OPENCODE_API_KEY`` / ``OPENCODE_MODEL`` (same convention as the
    TypeScript service).
    """
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=_model(),
        api_key=_api_key() or "not-set",
        base_url=_base_url(),
        temperature=0.1,
        max_tokens=2048,
        timeout=90,
    )


@cache
def get_vision_model():
    """LangChain ChatOpenAI for vision tasks (image input).

    Uses ``OPENCODE_VISION_MODEL`` (default ``openai/gpt-4o-mini``) so image
    understanding works even when the text model has no vision support.
    """
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=_vision_model(),
        api_key=_api_key() or "not-set",
        base_url=_base_url(),
        temperature=0.2,
        max_tokens=1024,
        timeout=90,
    )


@cache
def get_opencode_client():
    """Return an OpenRouter client (legacy transport).

    Uses the official ``openrouter`` SDK. The endpoint and API key are
    read from ``OPENCODE_API_URL`` / ``OPENCODE_API_KEY`` environment
    variables (same convention as the TypeScript service).

    Prefer :func:`get_chat_model` (LangChain) for new code.
    """
    from openrouter import OpenRouter  # type: ignore

    kwargs = {"api_key": _api_key() or ""}
    if _api_key():
        kwargs["server_url"] = _base_url()
    return OpenRouter(**kwargs)


def opencode_configured() -> bool:
    """True when an OpenCode API key is present and the LLM route can be used."""
    return bool(_api_key())


OPENCODE_BASE_URL = _base_url
__all__ = ["LMRE_PROMPT", "OPENCODE_BASE_URL", "get_chat_model", "get_vision_model", "get_opencode_client", "_model", "_vision_model", "opencode_configured"]
