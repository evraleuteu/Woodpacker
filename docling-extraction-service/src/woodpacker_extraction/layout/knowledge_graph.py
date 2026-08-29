"""Stage 8: Knowledge graph construction.

Node types : Lesson, Exercise, Question, Image, Audio, Video, Solution,
             Grammar, Vocabulary, Dialogue
Edges      : HAS_EXERCISE, HAS_IMAGE, HAS_AUDIO, HAS_SOLUTION, RELATED_TO,
             BELONGS_TO

The document itself becomes a Lesson node (id = file_id); exercises,
questions, images and media hang off it. Grammar/Vocabulary/Dialogue nodes
are emitted from deterministic content detection so downstream consumers can
filter by node type.
"""

from __future__ import annotations

import re
from typing import Any

from .types import AudioReference, DocumentBundle, Exercise, LayoutBlock

_GRAMMAR_RE = re.compile(
    r"\b(konjugation|präsens|praesens|präteritum|praeteritum|perfekt|plusquamperfekt|"
    r"akkusativ|dativ|nominativ|genitiv|modalverben|adjektivdeklination|artikel|imperativ)\b",
    re.IGNORECASE,
)
_VOCAB_RE = re.compile(r"\b(wortschatz|vokabeln|glossar|wörterliste|woerterliste)\b", re.IGNORECASE)
_DIALOGUE_RE = re.compile(r"\b(dialog|rollenspiel|gespräch|gespraech|interview)\b", re.IGNORECASE)

NODE_TYPES = ("Lesson", "Exercise", "Question", "Image", "Audio", "Video", "Solution", "Grammar", "Vocabulary", "Dialogue")
EDGE_TYPES = ("HAS_EXERCISE", "HAS_IMAGE", "HAS_AUDIO", "HAS_SOLUTION", "RELATED_TO", "BELONGS_TO")


def build_graph(
    bundle: DocumentBundle,
    blocks_by_id: dict[str, LayoutBlock],
) -> dict[str, Any]:
    """Assemble {nodes, links} for the whole document."""
    nodes: list[dict] = []
    links: list[dict] = []
    seen_nodes: set[str] = set()
    seen_edges: set[tuple[str, str, str]] = set()

    def add_node(node_id: str, ntype: str, label: str) -> None:
        if node_id in seen_nodes:
            return
        seen_nodes.add(node_id)
        nodes.append({"id": node_id, "type": ntype, "label": label[:120]})

    def add_edge(src: str, edge: str, dst: str, confidence: float) -> None:
        key = (src, edge, dst)
        if key in seen_edges:
            return
        seen_edges.add(key)
        links.append({"source": src, "relationship": edge, "target": dst, "confidence": round(confidence, 3)})

    lesson_id = bundle.file_id
    add_node(lesson_id, "Lesson", bundle.filename)

    grammar_seen: set[int] = set()
    vocab_seen: set[int] = set()
    dialogue_seen: set[int] = set()
    g_seq = v_seq = d_seq = 0

    for ex in bundle.exercises:
        add_node(ex.exercise_id, "Exercise", ex.name or ex.prompt or ex.exercise_type)
        add_edge(lesson_id, "HAS_EXERCISE", ex.exercise_id, 0.95)

        if ex.instruction_block:
            blk = blocks_by_id.get(ex.instruction_block)
            if _DIALOGUE_RE.search(blk.text if blk else ""):
                global_key = ("dialogue", hash(ex.instruction_block))
                if global_key not in dialogue_seen:
                    dialogue_seen.add(global_key)
                    d_seq += 1
                    did = f"{lesson_id}_dialog_{d_seq}"
                    add_node(did, "Dialogue", (blk.text if blk else "")[:80])
                    add_edge(did, "BELONGS_TO", ex.exercise_id, 0.85)

        for qid in ex.question_blocks:
            qblk = blocks_by_id.get(qid)
            add_node(qid, "Question", (qblk.text if qblk else "")[:100])
            anchor = ex.instruction_block or ex.exercise_id
            add_edge(anchor, "HAS_QUESTION" if anchor == ex.instruction_block else "BELONGS_TO", qid, 0.9)
            text = qblk.text if qblk else ""
            if _GRAMMAR_RE.search(text):
                key = hash(re.search(_GRAMMAR_RE, text).group(1).lower())
                if key not in grammar_seen:
                    grammar_seen.add(key)
                    g_seq += 1
                    gid = f"{lesson_id}_grammar_{g_seq}"
                    add_node(gid, "Grammar", re.search(_GRAMMAR_RE, text).group(1))
                    add_edge(gid, "RELATED_TO", qid, 0.7)
            if _VOCAB_RE.search(text):
                key = hash(text[:40].lower())
                if key not in vocab_seen:
                    vocab_seen.add(key)
                    v_seq += 1
                    vid = f"{lesson_id}_vocab_{v_seq}"
                    add_node(vid, "Vocabulary", text[:60])
                    add_edge(vid, "BELONGS_TO", qid, 0.7)

        for iid in ex.image_blocks:
            add_node(iid, "Image", iid)
            add_edge(ex.exercise_id, "HAS_IMAGE", iid, 0.85)

        for track in ex.audio_references:
            ref = next((r for r in bundle.audio_refs if r.ref_id == track), None)
            ntype = "Video" if (ref and ref.kind == "video") else "Audio"
            label = f"Track {ref.track}" if ref and ref.track is not None else track
            add_node(track, ntype, label)
            add_edge(ex.exercise_id, "HAS_AUDIO" if ntype == "Audio" else "RELATED_TO", track, 0.9)

    # Unattached audio refs still become Audio nodes on the lesson.
    attached = {l["target"] for l in links if l["relationship"] == "HAS_AUDIO"}
    for ref in bundle.audio_refs:
        if ref.ref_id in attached:
            continue
        ntype = "Video" if ref.kind == "video" else "Audio"
        add_node(ref.ref_id, ntype, f"{ref.kind.capitalize()} {ref.track or ''}".strip())
        add_edge(lesson_id, "RELATED_TO", ref.ref_id, 0.6)

    return {"nodes": nodes, "links": links}
