"""Pipeline entry points + adapter to the legacy result contracts.

Two consumers depend on the OLD result shape and must keep working:

* Next.js transform worker   -> ``flashcards`` per file (ExtractionFlashcard)
* NestJS extraction/ingest   -> exercises/items/relationships/knowledgeGraph/
                                quality/telemetry persisted to Postgres

:func:`to_legacy_result` projects a DocumentBundle onto that shape so both
consumers read the SAME deterministic layout-first output without schema
migrations. New consumers should use :func:`run_layout_analysis` directly.
"""

from __future__ import annotations

import logging
import re
import time
from typing import Any

from .graph import run_layout_pipeline
from .types import DocumentBundle, Exercise

logger = logging.getLogger(__name__)

_OPTION_LINE_RE = re.compile(r"^\s*([a-d])\s*[.)]\s+(.+)$", re.IGNORECASE | re.MULTILINE)

_MATERIAL_TYPE_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("solution_book", re.compile(r"lösung|loesung|solution|answer", re.IGNORECASE)),
    ("teacher_handbook", re.compile(r"lehrer|teacher|handbuch", re.IGNORECASE)),
    ("workbook", re.compile(r"übungsbuch|uebungsbuch|ubungsbuch|arbeitsbuch|workbook|exercise.?book", re.IGNORECASE)),
    ("lesson_book", re.compile(r"kursbuch|coursebook|textbook|lehrbuch|schülerbuch|student", re.IGNORECASE)),
)


def _classify_material_type(filename: str) -> str:
    name = (filename or "").lower()
    for mtype, pat in _MATERIAL_TYPE_PATTERNS:
        if pat.search(name):
            return mtype
    return "lesson_book" if name else "other"

# 15 spec types -> 8 flashcard-coarse types (Prisma ExerciseType enum).
COARSE_TYPE_MAP = {
    "multiple_choice": ("multiple-choice", None),
    "true_false": ("multiple-choice", ["Richtig", "Falsch"]),
    "fill_blank": ("fill-blank", None),
    "matching": ("pattern-drill", None),
    "ordering": ("pattern-drill", None),
    "grammar": ("pattern-drill", None),
    "drag_drop": ("pattern-drill", None),
    "listening": ("comprehension", None),
    "reading": ("comprehension", None),
    "image_description": ("recall", None),
    "vocabulary": ("recall", None),
    "speaking": ("roleplay", None),
    "dialogue": ("roleplay", None),
    "writing": ("assessment", None),
    "open_question": ("assessment", None),
}


def run_layout_analysis(
    pdf_path: str,
    file_id: str,
    *,
    filename: str | None = None,
    sha256: str = "",
    course_id: str = "",
    job_id: str | None = None,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Run the full deterministic pipeline; returns the bundle as plain JSON."""
    started = time.monotonic()
    bundle = run_layout_pipeline(
        pdf_path,
        file_id=file_id,
        filename=filename,
        sha256=sha256,
        course_id=course_id,
        job_id=job_id,
        context=context,
    )
    payload = bundle.to_dict()
    payload["wall_time_ms"] = round((time.monotonic() - started) * 1000, 1)
    return payload


# ---------------------------------------------------------------------------
# Legacy projection
# ---------------------------------------------------------------------------


def _chapter_of(filename: str) -> str:
    m = re.search(r"(kapitel|lektion|unit|lesson|modul|chapter)[\s_\-–.]*(\d+)", filename, re.IGNORECASE)
    return m.group(2) if m else ""


def _extract_options(text: str) -> list[str]:
    out: list[str] = []
    for m in _OPTION_LINE_RE.finditer(text or ""):
        value = m.group(2).strip()
        if value and value not in out:
            out.append(value[:120])
        if len(out) >= 6:
            break
    return out


def bundle_flashcards(bundle: dict[str, Any], source_id: str | None = None) -> list[dict[str, Any]]:
    """Project bundle exercises onto ExtractionFlashcard (Next.js contract)."""
    src = source_id or str(bundle.get("file_id") or "")
    ocr_by_block = {o["block_id"]: o["text"] for o in bundle.get("ocr", [])}
    blocks_by_id = {
        b["block_id"]: b
        for page in bundle.get("pages", [])
        for b in page.get("blocks", [])
    }
    cards: list[dict[str, Any]] = []

    def block_text(block_id: str | None) -> str:
        if not block_id:
            return ""
        b = blocks_by_id.get(block_id)
        if not b:
            return ""
        return ocr_by_block.get(block_id) or str(b.get("text") or "")

    for i, ex in enumerate(bundle.get("exercises", [])):
        coarse, forced_options = COARSE_TYPE_MAP.get(
            ex.get("exercise_type", "open_question"), ("assessment", None)
        )
        instruction = ex.get("instruction") or ""
        questions = [block_text(q) for q in ex.get("question_blocks", [])]
        questions = [q.strip() for q in questions if q and q.strip()]
        prompt = "\n".join([instruction.strip(), *questions]).strip()
        if not prompt:
            continue
        options = forced_options or (_extract_options(prompt) if coarse == "multiple-choice" else [])
        pages = ex.get("pages") or [0, 0]
        page_str = f"S. {pages[0]}" if pages and pages[0] else None
        if pages and len(pages) == 2 and pages[0] and pages[1] and pages[0] != pages[1]:
            page_str = f"S. {pages[0]}-{pages[1]}"
        # Stable key for cross-material dedup (mirrors identity.py).
        nm = ex.get("name") or ""
        mnum = re.search(r"(\d+[a-z]?)", nm)
        number = mnum.group(1) if mnum else ""
        chapter_hint = _chapter_of(nm or instruction[:40])
        try:
            from ..identity import stable_exercise_key  # type: ignore

            skey = stable_exercise_key(
                course_id="",
                material_id=src,
                chapter=chapter_hint,
                number=number,
                prompt=prompt,
                pages=[int(pages[0])] if pages and pages[0] else [],
            )
        except Exception:  # noqa: BLE001
            import hashlib as _hashlib

            skey = _hashlib.sha256(f"{src}:{prompt[:80]}".encode()).hexdigest()[:12]
        cards.append({
            "id": ex["id"],
            "type": coarse,
            "prompt": prompt,
            "answer": None,
            "options": options,
            "page": page_str,
            "name": ex.get("name") or "",
            "source": src,
            "exercise_type": ex.get("exercise_type"),
            "type_confidence": ex.get("type_confidence"),
            "stable_key": skey,
        })
    return cards


def to_legacy_result(bundle_dict: dict[str, Any], *, filename: str | None = None) -> dict[str, Any]:
    """Project a bundle JSON onto the legacy pipeline result contract."""
    fname = filename or str(bundle_dict.get("filename") or "")
    chapter = _chapter_of(fname)
    quality = dict(bundle_dict.get("quality") or {})

    exercises_out: list[dict[str, Any]] = []
    flashcards: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
    ocr_by_block = {o["block_id"]: o["text"] for o in bundle_dict.get("ocr", [])}
    blocks_by_id = {
        b["block_id"]: b
        for page in bundle_dict.get("pages", [])
        for b in page.get("blocks", [])
    }

    for ex in bundle_dict.get("exercises", []):
        eid = ex["id"]
        pages = ex.get("pages") or [0]
        instruction_text = ""
        ins_block = ex.get("instruction_block")
        if ins_block and ins_block in blocks_by_id:
            instruction_text = ocr_by_block.get(ins_block) or str(blocks_by_id[ins_block].get("text") or "")
        exercises_out.append({
            "exercise_id": eid,
            "chapter": chapter,
            "section": ex.get("name") or "",
            "exercise_title": ex.get("name") or instruction_text[:80],
            "exercise_type": ex.get("exercise_type", "open_question"),
            "page": int(pages[0] or 0),
        })
        for pos, qid in enumerate(ex.get("question_blocks", []), start=1):
            qblk = blocks_by_id.get(qid)
            items.append({
                "exercise_item_id": f"{eid}-q{pos}",
                "exercise_id": eid,
                "question": (ocr_by_block.get(qid) or (str(qblk.get("text")) if qblk else ""))[:400],
                "answer": None,
                "position": pos,
                "page": f"S. {(ex.get('pages') or [None])[0]}" if ex.get("pages") else None,
                "linked_images": [
                    iid.replace("page_", "img_", 1) if iid.startswith("page_") else iid
                    for iid in ex.get("image_blocks", [])
                ],
                "linked_audio": list(ex.get("audio_references", [])),
            })

        # Reuse the flashcard projector for one card per exercise.
        single = {"file_id": bundle_dict.get("file_id"), "exercises": [ex]}
        flashcards.extend(bundle_flashcards(single))

    # Legacy relationship shape: {relationship, from, to, confidence, rationale}
    legacy_rels = [
        {
            "relationship": r["relationship"],
            "from": r["from"],
            "to": r["to"],
            "confidence": r["confidence"],
            "rationale": r.get("rationale", ""),
        }
        for r in bundle_dict.get("relationships", [])
    ]
    # Legacy knowledgeGraph: nodes [{id,type,label}], links [{from,to,type,confidence}]
    kg_nodes = [
        {"id": n["id"], "type": str(n.get("type", "")).lower(), "label": n.get("label", "")}
        for n in (bundle_dict.get("knowledge_graph") or {}).get("nodes", [])
    ]
    kg_links = [
        {"from": l["source"], "to": l["target"], "type": l["relationship"], "confidence": l["confidence"]}
        for l in (bundle_dict.get("knowledge_graph") or {}).get("links", [])
    ]

    word_count = sum(len((ocr_by_block.get(b["block_id"]) or str(b.get("text") or "")).split())
                     for page in bundle_dict.get("pages", []) for b in page.get("blocks", []))

    def _image_meta(image_id: str) -> tuple[int, list[float]]:
        for page in bundle_dict.get("pages", []):
            for blk in page.get("blocks", []):
                if blk["block_id"] == image_id:
                    return int(page.get("page", 0)), list(blk.get("bbox") or [0, 0, 0, 0])
        return 0, [0, 0, 0, 0]

    issues = list(quality.get("issues") or [])
    status = "needs_review" if issues else "processed"

    legacy_layout_blocks = [
        {
            "type": b.get("type", "unknown"),
            "text": str(b.get("text") or "")[:500],
            "bbox": b.get("bbox", [0, 0, 0, 0]),
            "page": page.get("page", 0),
            "spans": [],
        }
        for page in bundle_dict.get("pages", [])
        for b in page.get("blocks", [])
    ][:400]

    return {
        "engine": "layout",
        "course": {},
        "chapters": [],
        "lessons": [],
        "topics": [],
        "grammar_rules": [],
        "vocabulary": [],
        "images": [
            {
                "image_id": u.get("image_id"),
                **dict(zip(("page", "bbox"), _image_meta(u.get("image_id") or ""))),
                "ext": "png",
                "description": u.get("description"),
                "keywords": u.get("keywords", []),
            }
            for u in bundle_dict.get("images", [])
        ],
        "audio": [
            {"ref_id": a["ref_id"], "track": a.get("track"), "cd": a.get("cd"), "kind": a.get("kind")}
            for a in bundle_dict.get("audio_references", [])
        ],
        "layout_blocks": legacy_layout_blocks,
        "classifications": [{
            "file_id": bundle_dict.get("file_id"),
            "file_name": fname,
            "file_type": _classify_material_type(fname),
            "confidence": 0.7,
        }],
        "exercises": exercises_out,
        "flashcards": flashcards,
        "questions": items,
        "answers": [],
        "relationships": legacy_rels,
        "material_links": [],
        "knowledgeGraph": {"nodes": kg_nodes, "links": kg_links},
        "quality": {
            "exercises_extracted": len(exercises_out),
            "orphan_audio": max(0, len(bundle_dict.get("audio_references", [])) - sum(1 for e in bundle_dict.get("exercises", []) if e.get("audio_references"))),
            "orphan_video": 0,
            "duplicate_exercises": 0,
            "missing_solutions": 0,
            "issues": issues,
            "total_pages": quality.get("pages_total", bundle_dict.get("page_count", 0)),
            "processed_pages": quality.get("pages_with_content", 0),
            "orphan_media_count": len(bundle_dict.get("audio_references", []) or []),
            "duplicate_candidates": 0,
            **{k: quality[k] for k in (
                "coverage", "pages_total", "pages_with_content",
                "layout_taxonomy", "layout_provider_counts", "blocks_detected",
                "blocks_cropped", "ocr_blocks", "classification_llm_calls",
                "vision_calls", "exercises_segmented", "relationships",
                "kg_nodes", "kg_links", "type_taxonomy", "audio_references",
                "truncation", "capped",
            ) if k in quality},
        },
        "extraction_mode": "layout-deterministic",
        "llm_usage": {"calls": bundle_dict.get("llm_calls", 0)},
        "ocr_used": any(o.get("engine") not in ("text_layer",) for o in bundle_dict.get("ocr", [])),
        "ocr_engine": bundle_dict.get("providers_used", {}).get("ocr", "pymupdf"),
        "is_scanned": not all(p.get("has_text_layer") for p in bundle_dict.get("pages", [{"has_text_layer": True}])),
        "page_count": bundle_dict.get("page_count", 0),
        "word_count": word_count,
        "sha256": bundle_dict.get("sha256", ""),
        "status": status,
        "telemetry": bundle_dict.get("telemetry", []),
        "artifacts": bundle_dict.get("artifacts", {}),
        "providers_used": bundle_dict.get("providers_used", {}),
    }
