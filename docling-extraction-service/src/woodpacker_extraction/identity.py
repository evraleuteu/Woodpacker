"""Stable exercise identification and fuzzy duplicate detection.

Replaces lowercase(prompt)-equality dedup with content-addressed identities
and similarity-based duplicate candidates. Uncertain duplicates are flagged
``needs_review`` — never auto-merged.
"""

from __future__ import annotations

import hashlib
import re
from difflib import SequenceMatcher
from typing import Any

_WORD_RE = re.compile(r"[a-zäöüß0-9]+", re.IGNORECASE)
_PUNCT_RE = re.compile(r"[^\w\s]", re.UNICODE)


def normalize_prompt(prompt: str) -> str:
    """Lowercase, strip punctuation/markdown artifacts, collapse whitespace."""
    text = _PUNCT_RE.sub(" ", (prompt or "").lower())
    return re.sub(r"\s+", " ", text).strip()


def prompt_tokens(prompt: str) -> set[str]:
    """Normalized token set used for similarity (stopword-light)."""
    return set(_WORD_RE.findall(normalize_prompt(prompt)))


def token_jaccard(a: str, b: str) -> float:
    ta, tb = prompt_tokens(a), prompt_tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def sequence_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, normalize_prompt(a), normalize_prompt(b)).ratio()


def exercise_number(name_or_prompt: str) -> str | None:
    """Extract canonical exercise number incl. subexercise: 'Aufgabe 5b' -> '5b'."""
    text = name_or_prompt or ""
    patterns = [
        r"(?:aufgabe|übung|ubung|exercise|ex\.|aufg\.|task|aktivität)\s*(\d{1,3}\s*[a-z]?)",
        r"^\s*(\d{1,3}\s*[a-z]?)\s*[.)]",
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return re.sub(r"\s+", "", m.group(1).lower())
    return None


def stable_exercise_key(
    *,
    course_id: str = "",
    material_id: str = "",
    chapter: str = "",
    number: str | None = None,
    prompt: str = "",
    pages: list[int] | None = None,
) -> str:
    """Deterministic identity: sha256 of the semantic coordinates.

    Same exercise re-uploaded (same publisher material) maps to the same key,
    making persistence idempotent without depending on random UUIDs.
    """
    parts = [
        (course_id or "").strip().lower(),
        (material_id or "").strip().lower(),
        (chapter or "").strip().lower(),
        (number or "").strip().lower(),
        normalize_prompt(prompt)[:400],
        ",".join(str(p) for p in sorted(pages or [])),
    ]
    digest = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()
    return f"exk-{digest[:24]}"


def find_duplicates(
    exercises: list[dict[str, Any]],
    *,
    similarity_threshold: float = 0.85,
) -> list[dict[str, Any]]:
    """Flag fuzzy duplicates within one extraction result.

    Duplicate candidate when: high prompt similarity AND (same exercise
    number OR same page). The later occurrence gets
    ``duplicate_of=<exercise_id>`` and ``needs_review=True`` when uncertain
    (similarity below 0.97 exact-ish threshold); certain duplicates are
    marked ``duplicate_confirmed=True`` and dropped by the caller.
    """
    out: list[dict[str, Any]] = []
    seen: list[tuple[str, str | None, str, dict[str, Any]]] = []  # (prompt, number, chapter, ex)
    for ex in exercises:
        prompt = ex.get("prompt", "")
        number = ex.get("_number") or exercise_number(ex.get("name") or prompt)
        chapter = str(ex.get("chapter", ""))
        duplicate_of = None
        confirmed = False
        uncertain = False
        for prev_prompt, prev_number, prev_chapter, prev_ex in seen:
            sim = token_jaccard(prompt, prev_prompt)
            same_number = bool(number and prev_number and number == prev_number)
            same_page = (
                ex.get("page") is not None
                and prev_ex.get("page") is not None
                and str(ex.get("page")) == str(prev_ex.get("page"))
            )
            if sim >= 0.97:
                # Near-identical text: certain duplicate regardless of metadata.
                duplicate_of, confirmed = prev_ex.get("exercise_id"), True
                break
            if sim >= 0.85 and (same_number or same_page):
                duplicate_of, confirmed = prev_ex.get("exercise_id"), True
                break
            if sim >= 0.45 and same_number:
                # Same chapter/number, moderately similar prompts (Übungsbuch
                # often reformulates Kursbuch tasks) → uncertain candidate.
                duplicate_of, uncertain = prev_ex.get("exercise_id"), True
                break
        ex = dict(ex)
        ex["_number"] = number
        if duplicate_of:
            ex["duplicate_of"] = duplicate_of
            ex["duplicate_confirmed"] = confirmed
            if uncertain:
                ex["needs_review"] = True
        out.append(ex)
        seen.append((prompt, number, chapter, ex))
    return out


__all__ = [
    "normalize_prompt",
    "prompt_tokens",
    "token_jaccard",
    "sequence_similarity",
    "exercise_number",
    "stable_exercise_key",
    "find_duplicates",
]
