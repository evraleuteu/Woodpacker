"""Cross-material relationship engine (batch level, runs ONCE per course).

Fixes the false-match class where "Aufgabe 5" in Kapitel 3 linked to an
unrelated "Aufgabe 5" in Kapitel 7. Relationships now require corroboration:

* chapter_match         — same chapter AND complementary material types
* exercise_number_match — same chapter + same number + complementary types
                          (+ prompt similarity for borderline confidence)
* solution_link         — solution reference resolves to a solution-type
                          sibling covering that chapter
* media links           — resolved per-file against the real inventory
                          (graph.py node_media_link); this module only adds
                          course-level links for cross-file solution/chapter
                          relations.

Never matches on exercise number alone. Uncertain candidates are emitted
with ``needs_review: true`` instead of being silently linked.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from . import identity as ident
from .extractor import chapter_number

logger = logging.getLogger(__name__)

# Material-type pairs considered complementary (a Kursbuch exercise and an
# Übungsbuch exercise with the same number are plausibly related; two
# exercises inside the SAME Kursbuch with the same number are not).
_COMPLEMENTARY = {
    frozenset({"lesson_book", "workbook"}),
    frozenset({"lesson_book", "exercise_book"}),
    frozenset({"lesson_book", "solution_book"}),
    frozenset({"workbook", "solution_book"}),
    frozenset({"exercise_book", "solution_book"}),
    frozenset({"workbook", "teacher_handbook"}),
    frozenset({"lesson_book", "teacher_handbook"}),
    frozenset({"exercise_book", "teacher_handbook"}),
}

_SOLUTION_REF_RE = re.compile(r"lösung|loesung|solution|lehrerhandbuch", re.IGNORECASE)


def build_course_relationships(
    results: list[dict[str, Any]],
    summaries: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build relationships across per-file extraction results.

    ``results``   — one merged pipeline result per file (order-stable)
    ``summaries`` — DocumentAsset.to_summary() aligned index-wise with results

    Returns {"relationships": [...], "links": [...]} suitable for merging
    into the batch payload.
    """
    relationships: list[dict[str, Any]] = []
    links: list[dict[str, Any]] = []

    # Index: file_id -> (summary, result)
    entries: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for summary, result in zip(summaries, results):
        if not isinstance(result, dict):
            continue
        material_type = (
            (result.get("classifications") or [{}])[0].get("file_type")
            or summary.get("material_type")
            or "other"
        )
        entries.append(
            {
                **summary,
                "material_type": material_type,
                "file_id": summary.get("file_id")
                or (result.get("classifications") or [{}])[0].get("file_id"),
                "result": result,
            }
        )

    for a_idx, a in enumerate(entries):
        a_chapter = _chapter_of(a)
        a_exercises = a["result"].get("exercises") or []
        a_flashcards = {(fc.get("id")): fc for fc in a["result"].get("flashcards") or []}

        # Solution links don't depend on chapter alignment — any exercise
        # referencing "Lösung Seite N" links to a solution-type sibling.
        for b in entries[a_idx + 1:]:
            for src, dst in ((a, b), (b, a)):
                if dst["material_type"] not in ("solution_book", "teacher_handbook"):
                    continue
                if src["material_type"] == dst["material_type"]:
                    continue
                for fc in src["result"].get("flashcards") or []:
                    prompt = fc.get("prompt", "")
                    if not _SOLUTION_REF_RE.search(prompt):
                        continue
                    for page in _solution_pages(prompt):
                        rel = _rel(
                            "solution_link",
                            fc.get("id"),
                            f"solution-{dst['file_id']}-page-{page}",
                            0.8,
                            f"Exercise references solution on page {page} of {dst.get('filename', '')}",
                        )
                        _push_unique(relationships, links, rel)

        for b in entries[a_idx + 1:]:
            b_chapter = _chapter_of(b)

            # ---- chapter_match -------------------------------------------
            if (
                a_chapter
                and b_chapter
                and a_chapter == b_chapter
                and _complementary(a["material_type"], b["material_type"])
            ):
                rel = _rel(
                    "chapter_match", a["file_id"], b["file_id"], 0.9,
                    f"Both files cover Chapter {a_chapter}",
                )
                _push_unique(relationships, links, rel)

            # ---- exercise_number_match -----------------------------------
            if not (a_chapter and b_chapter and a_chapter == b_chapter):
                continue
            if not _complementary(a["material_type"], b["material_type"]):
                continue
            b_exercises = b["result"].get("exercises") or []
            for ex_a in a_exercises:
                num_a = ident.exercise_number(ex_a.get("section") or ex_a.get("exercise_title") or "")
                if not num_a:
                    continue
                for ex_b in b_exercises:
                    num_b = ident.exercise_number(ex_b.get("section") or ex_b.get("exercise_title") or "")
                    if num_a != num_b:
                        continue
                    fc_a = a_flashcards.get(ex_a.get("exercise_id"))
                    fc_b = next(
                        (fc for fc in (b["result"].get("flashcards") or []) if fc.get("id") == ex_b.get("exercise_id")),
                        None,
                    )
                    similarity = (
                        ident.token_jaccard((fc_a or {}).get("prompt", ""), (fc_b or {}).get("prompt", ""))
                        if fc_a and fc_b
                        else 0.0
                    )
                    # Corroborated: same chapter + same number + complementary books.
                    confidence = 0.85
                    needs_review = False
                    if similarity >= 0.6:
                        confidence = 0.92
                    elif similarity < 0.3:
                        # Number matches but prompts diverge — plausible pair
                        # (Übungsbuch reformulates), still flag for review.
                        needs_review = True
                    rel = _rel(
                        "exercise_number_match",
                        ex_a.get("exercise_id"),
                        ex_b.get("exercise_id"),
                        confidence,
                        f"'{num_a}' in Chapter {a_chapter} across "
                        f"{a['material_type']}/{b['material_type']} (sim={similarity:.2f})",
                    )
                    if needs_review:
                        rel["needs_review"] = True
                    _push_unique(relationships, links, rel)

            # ---- solution_link -------------------------------------------
            if b["material_type"] in ("solution_book", "teacher_handbook"):
                for fc in a["result"].get("flashcards") or []:
                    prompt = fc.get("prompt", "")
                    if not _SOLUTION_REF_RE.search(prompt):
                        continue
                    pages = _solution_pages(prompt)
                    for page in pages:
                        rel = _rel(
                            "solution_link",
                            fc.get("id"),
                            f"solution-{b['file_id']}-page-{page}",
                            0.8,
                            f"Exercise references solution on page {page} of {b.get('filename', '')}",
                        )
                        _push_unique(relationships, links, rel)

    logger.info("Relationship engine: %d relationships across %d files", len(relationships), len(entries))
    return {"relationships": relationships, "links": links}


def _chapter_of(entry: dict[str, Any]) -> str | None:
    for source in (entry.get("filename"), entry.get("path")):
        if source:
            ch = chapter_number(str(source))
            if ch:
                return ch
    return None


def _complementary(type_a: str, type_b: str) -> bool:
    return frozenset({type_a, type_b}) in _COMPLEMENTARY


def _solution_pages(text: str) -> list[int]:
    pages: list[int] = []
    for m in re.finditer(r"(?:seite|page|s\.)\s*(\d{1,4})", text, re.IGNORECASE):
        pages.append(int(m.group(1)))
    return sorted(set(pages))


def _rel(relationship: str, src: Any, dst: Any, confidence: float, rationale: str) -> dict[str, Any]:
    return {
        "relationship": relationship,
        "from": src,
        "to": dst,
        "confidence": confidence,
        "rationale": rationale,
    }


def _push_unique(
    relationships: list[dict[str, Any]],
    links: list[dict[str, Any]],
    rel: dict[str, Any],
) -> None:
    key = (rel["relationship"], rel["from"], rel["to"])
    if any((r["relationship"], r["from"], r["to"]) == key for r in relationships):
        return
    relationships.append(rel)
    links.append(rel)


__all__ = ["build_course_relationships"]
