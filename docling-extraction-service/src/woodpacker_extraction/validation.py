"""Exercise validation — Python port of ``src/lib/exercise-validation.ts``.

The canonical rules live in
``Context Files/Exercise_Extraction_Skill/validation_rules.md``; this module is
the single source of truth for which extracted exercises reach a course in the
new Python extraction stack. Every rejection gate in the TypeScript service has
a mirror here, and every junk pattern in ``prompt_rules.md`` must also be
rejected by :func:`is_junk_exercise_prompt` / :func:`validate_extracted_exercise`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Optional

VALID_EXERCISE_TYPES: tuple[str, ...] = (
    "fill-blank",
    "multiple-choice",
    "translation",
    "recall",
    "pattern-drill",
    "roleplay",
    "comprehension",
    "assessment",
)

REQUIRED_ANSWER_TYPES: frozenset[str] = frozenset(
    {"fill-blank", "multiple-choice", "translation", "recall"}
)

# LLMs naturally label exercises with types outside the canonical 8
# (e.g. "grammar", "speaking", "listening" for a Grammatik table page or a
# "Flüssig sprechen" task). Rejecting them silently dropped every exercise
# on such pages. Map common synonyms onto canonical types instead; only
# unmappable types are rejected as invalid-type.
EXERCISE_TYPE_ALIASES: dict[str, str] = {
    "grammar": "fill-blank",
    "grammatik": "fill-blank",
    "gap-fill": "fill-blank",
    "gap_fill": "fill-blank",
    "cloze": "fill-blank",
    "speaking": "roleplay",
    "sprechen": "roleplay",
    "dialog": "roleplay",
    "role-play": "roleplay",
    "role_play": "roleplay",
    "listening": "comprehension",
    "hören": "comprehension",
    "hoeren": "comprehension",
    "reading": "comprehension",
    "lesen": "comprehension",
    "video": "comprehension",
    "vocabulary": "recall",
    "vocab": "recall",
    "wortschatz": "recall",
    "matching": "recall",
    "match": "recall",
    "writing": "assessment",
    "schreiben": "assessment",
    "essay": "assessment",
    "short_answer": "assessment",
    "short-answer": "assessment",
    "ordering": "assessment",
    "order": "assessment",
    "true_false": "multiple-choice",
    "true-false": "multiple-choice",
    "drag_drop": "multiple-choice",
    "drag-drop": "multiple-choice",
    "quiz": "assessment",
    "test": "assessment",
}


def canonical_exercise_type(ex_type: Any) -> str:
    """Map a raw LLM/extractor type onto a canonical VALID_EXERCISE_TYPES value.

    Returns the lowercased input unchanged when no alias matches, so callers
    can still detect genuinely invalid types.
    """
    t = str(ex_type or "").strip().lower().replace("_", "-")
    t = t.replace("fill_blank", "fill-blank").replace("multiple_choice", "multiple-choice")
    return EXERCISE_TYPE_ALIASES.get(t, t)

# Junk prompt patterns (validation_rules.md § "Junk prompt patterns")
_ARROW_RE = re.compile(r"›")
_NUM_SEQUENCE_RE = re.compile(r"^\s*\d+(\.\d+)?(\s+\d+(\.\d+)?){2,}\b")
_MEDIA_PREFIX_RE = re.compile(r"^\s*(cd\s*1?|track|spur)\b", re.IGNORECASE)
_DIGITS_ONLY_RE = re.compile(r"^[\d\s.,:;()\-–—]+$")

_PAGE_MARKER_RE = re.compile(r"\[PAGE\s*\d+\]", re.IGNORECASE)
_LETTERS_RE = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]")
_LOWERCASE_RE = re.compile(r"[a-zà-öø-ÿ]")
_TRACK_NAME_RE = re.compile(r"^\d+(\.\d+)?$")
_PAGE_NUM_RE = re.compile(r"\d")
_CTRL_RE = re.compile(r"[\u0000-\u0008\u000B\u000C\u000E-\u001F]")

_BOLD_RE = re.compile(r"\*\*([^*]+)\*\*")
_DOUBLE_UNDER_RE = re.compile(r"__([^_]+)__")
_BACKTICK_RE = re.compile(r"`([^`]+)`")
_ITALIC_RE = re.compile(r"\*([^*]+)\*")
_LETTER_PREFIX_RE = re.compile(r"^[a-z]\s*[).]\s*")


@dataclass
class ValidationResult:
    """Result of validating one raw extracted exercise."""

    valid: bool
    reasons: list[str] = field(default_factory=list)
    exercise: Optional[dict[str, Any]] = None


def strip_markdown(value: str) -> str:
    """Remove ``**bold**``, ``__bold__``, backtick code and ``*italic*``.

    Mirrors ``stripMarkdown`` in ``exercise-validation.ts``.
    """
    return _ITALIC_RE.sub(
        r"\1",
        _BACKTICK_RE.sub(
            r"\1",
            _DOUBLE_UNDER_RE.sub(
                r"\1",
                _BOLD_RE.sub(r"\1", value),
            ),
        ),
    )


def normalize(value: str) -> str:
    """Normalize for answer/option comparison: trim, lowercase, collapse space, strip ``a) `` letters."""
    return _LETTER_PREFIX_RE.sub("", re.sub(r"\s+", " ", (value or "").strip().lower()))


def is_junk_exercise_prompt(prompt: str) -> bool:
    """Cheap pre-filter: reject track listings, arrows, digit-only lines, empty prompts."""
    p = (prompt or "").strip()
    if not p:
        return True
    if _ARROW_RE.search(p):
        return True
    if _NUM_SEQUENCE_RE.match(p):
        return True
    if _MEDIA_PREFIX_RE.match(p):
        return True
    if _DIGITS_ONLY_RE.match(p):
        return True
    return False


def _clean_reference(value: Optional[str], max_len: int) -> Optional[str]:
    v = (value or "").strip()
    if not v or len(v) > max_len or _CTRL_RE.search(v):
        return None
    return v


def _fail(reasons: list[str], reason: str) -> ValidationResult:
    reasons.append(reason)
    return ValidationResult(valid=False, reasons=reasons)


def validate_extracted_exercise(
    raw: dict[str, Any],
    *,
    require_answer: bool = False,
) -> ValidationResult:
    """Validate a raw extracted exercise before it reaches a course.

    Mirrors ``validateExtractedExercise`` from ``exercise-validation.ts`` —
    rejection gates in order: type, prompt quality, page marker, junk pattern,
    letters, all-caps title, track-number name, page-without-number, missing
    answer, answer too long, MC option integrity.
    """
    reasons: list[str] = []

    ex_type = canonical_exercise_type(raw.get("type"))
    if ex_type not in VALID_EXERCISE_TYPES:
        return _fail(reasons, f"invalid-type:{raw.get('type') or ''}")

    prompt = strip_markdown((raw.get("prompt") or "").strip())
    if not prompt:
        return _fail(reasons, "empty-prompt")
    if len(prompt) < 8:
        return _fail(reasons, "prompt-too-short")
    if len(prompt) > 2000:
        return _fail(reasons, "prompt-too-long")
    if _PAGE_MARKER_RE.search(prompt):
        return _fail(reasons, "contains-page-marker")
    if is_junk_exercise_prompt(prompt):
        return _fail(reasons, "junk-prompt")
    letters = len(_LETTERS_RE.findall(prompt))
    if letters < 2:
        return _fail(reasons, "no-letters")
    lower = len(_LOWERCASE_RE.findall(prompt))
    if lower == 0 and len(prompt) < 40:
        return _fail(reasons, "all-caps-title")

    name = _clean_reference(raw.get("name"), 60)
    page = _clean_reference(raw.get("page"), 30)
    if name and _TRACK_NAME_RE.match(name):
        return _fail(reasons, f"track-number-name:{name}")
    if page and not _PAGE_NUM_RE.search(page):
        return _fail(reasons, "page-without-number")

    answer_raw = (raw.get("answer") or "").strip()
    if require_answer and ex_type in REQUIRED_ANSWER_TYPES and not answer_raw:
        return _fail(reasons, "missing-answer")
    answer: Optional[str] = None
    if answer_raw:
        answer = strip_markdown(answer_raw)
        max_len = 150 if ex_type == "fill-blank" else 800
        if len(answer) > max_len:
            return _fail(reasons, f"answer-too-long:{ex_type}")

    options: Optional[list[str]] = None
    if ex_type == "multiple-choice":
        options = [strip_markdown(o).strip() for o in (raw.get("options") or [])]
        options = [o for o in options if o][:6]
        if len(options) < 2:
            return _fail(reasons, "too-few-options")
        if len({normalize(o) for o in options}) < 2:
            return _fail(reasons, "duplicate-options")
        if require_answer and answer:
            normalized_answer = normalize(answer)
            exact = next((o for o in options if normalize(o) == normalized_answer), None)
            prefix = exact
            if prefix is None and len(normalized_answer) >= 3:
                prefix = next(
                    (
                        o
                        for o in options
                        if normalize(o).startswith(normalized_answer)
                        or (len(normalized_answer) >= 4 and normalized_answer.startswith(normalize(o)))
                    ),
                    None,
                )
            if prefix is None:
                return _fail(reasons, "answer-not-in-options")
            answer = prefix

    exercise: dict[str, Any] = {"type": ex_type, "prompt": prompt}
    if answer:
        exercise["answer"] = answer
    if options:
        exercise["options"] = options
    if name:
        exercise["name"] = name
    if page:
        exercise["page"] = page

    return ValidationResult(valid=True, reasons=[], exercise=exercise)


# --- Page reference helpers (used by the relationship engine) ---------------

_PAGE_REF_RE = re.compile(r"(\d{1,4})(?:\s*[-–—]\s*(\d{1,4}))?")


def parse_page_refs(page: str) -> list[int]:
    """"S. 24-26" → [24,25,26], "S. 10, 12" → [10,12], "A6" → [6]."""
    nums: list[int] = []
    for m in _PAGE_REF_RE.finditer(page or ""):
        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else None
        if end is not None:
            if end >= start:
                for n in range(start, min(end, start + 64) + 1):
                    nums.append(n)
            else:
                nums.extend([start, end])
        else:
            nums.append(start)
    return nums


__all__ = [
    "VALID_EXERCISE_TYPES",
    "REQUIRED_ANSWER_TYPES",
    "EXERCISE_TYPE_ALIASES",
    "ValidationResult",
    "strip_markdown",
    "normalize",
    "canonical_exercise_type",
    "is_junk_exercise_prompt",
    "validate_extracted_exercise",
    "parse_page_refs",
]