"""Stage 7: Relationship builder.

Formalizes the links produced by exercise grouping plus deterministic
proximity relations between blocks:

    Instruction  -HAS_QUESTION->  Question      (from grouping)
    Exercise     -HAS_IMAGE->    Image block    (from grouping)
    Exercise     -HAS_AUDIO->    track_N ref    (from grouping)
    Instruction  -PRECEDES->     next instruction (reading order)
    Image        -RELATED_TO->   nearest instruction (same column band)

Confidence derives from geometric proximity and grouping certainty.
"""

from __future__ import annotations

import logging

from .types import AudioReference, Exercise, LayoutBlock, Relationship

logger = logging.getLogger(__name__)

_VERTICAL_BAND = 260.0  # px at RENDER_DPI=200 (~3.3cm) for same-region proximity


def build_relationships(
    exercises: list[Exercise],
    blocks_by_id: dict[str, LayoutBlock],
    audio_refs: list[AudioReference],
    ordered_ids: list[str],
) -> list[Relationship]:
    out: list[Relationship] = []

    for ex in exercises:
        if ex.instruction_block:
            for qid in ex.question_blocks:
                out.append(Relationship(
                    "HAS_QUESTION", ex.instruction_block, qid,
                    _proximity_confidence(blocks_by_id.get(ex.instruction_block), blocks_by_id.get(qid), 0.9),
                    "Question grouped under instruction in reading order",
                ))
        for iid in ex.image_blocks:
            anchor = ex.instruction_block or (ex.question_blocks[0] if ex.question_blocks else None)
            out.append(Relationship(
                "HAS_IMAGE", ex.exercise_id, iid,
                _proximity_confidence(blocks_by_id.get(anchor) if anchor else None, blocks_by_id.get(iid), 0.8),
                "Image within exercise region",
            ))
        for track in ex.audio_references:
            conf = 0.95 if track.startswith("track_") else 0.7
            out.append(Relationship(
                "HAS_AUDIO", ex.exercise_id, track, conf,
                "Audio reference inside exercise region",
            ))
        for aid in ex.answer_area_blocks:
            out.append(Relationship(
                "BELONGS_TO", aid, ex.exercise_id, 0.85,
                "Answer area belongs to exercise region",
            ))

    # Media refs -> owning exercise (inverse edge for graph traversal).
    seen_pairs: set[tuple[str, str]] = set()
    for rel in out:
        seen_pairs.add((rel.from_ref, rel.to_ref))
    for ref in audio_refs:
        for block_id in ref.block_ids:
            owner = _owner_exercise(exercises, block_id)
            if owner and (owner, ref.ref_id) not in seen_pairs:
                out.append(Relationship(
                    "BELONGS_TO", ref.ref_id, owner, 0.8,
                    f"Track {ref.track} referenced by block {block_id}",
                ))
                seen_pairs.add((owner, ref.ref_id))

    # Reading-order chain between instructions on the same page flow.
    prev_instruction: str | None = None
    for bid in ordered_ids:
        block = blocks_by_id.get(bid)
        if block is None or block.type != "instruction":
            continue
        if prev_instruction:
            out.append(Relationship(
                "PRECEDES", prev_instruction, bid, 0.75, "Reading order sequence"
            ))
        prev_instruction = bid

    # Unlinked images near an instruction get RELATED_TO.
    linked_images = {r.to_ref for r in out if r.relationship == "HAS_IMAGE"}
    for bid, block in blocks_by_id.items():
        if block.type != "image" or bid in linked_images:
            continue
        near = _nearest_instruction(exercises, blocks_by_id, bid)
        if near:
            out.append(Relationship(
                "RELATED_TO", bid, near, 0.6, "Geometrically adjacent to instruction"
            ))
    return out


def _proximity_confidence(a: LayoutBlock | None, b: LayoutBlock | None, base: float) -> float:
    if a is None or b is None:
        return round(base * 0.8, 3)
    gap_y = abs((a.bbox[1] + a.bbox[3]) / 2 - (b.bbox[1] + b.bbox[3]) / 2)
    if gap_y <= _VERTICAL_BAND:
        return round(min(0.98, base + 0.05 * (1 - gap_y / max(_VERTICAL_BAND, 1.0))), 3)
    return round(base * 0.85, 3)


def _owner_exercise(exercises: list[Exercise], block_id: str) -> str | None:
    for ex in exercises:
        if (
            block_id == ex.instruction_block
            or block_id in ex.question_blocks
            or block_id in ex.answer_area_blocks
            or block_id in ex.image_blocks
        ):
            return ex.exercise_id
    return None


def _nearest_instruction(
    exercises: list[Exercise],
    blocks_by_id: dict[str, LayoutBlock],
    image_block_id: str,
) -> str | None:
    img = blocks_by_id.get(image_block_id)
    if img is None:
        return None
    best: tuple[float, str] | None = None
    for ex in exercises:
        if not ex.instruction_block:
            continue
        ins = blocks_by_id.get(ex.instruction_block)
        if ins is None:
            continue
        dist = abs((ins.bbox[1] + ins.bbox[3]) / 2 - (img.bbox[1] + img.bbox[3]) / 2)
        if best is None or dist < best[0]:
            best = (dist, ex.instruction_block)
    if best and best[0] <= _VERTICAL_BAND * 2.5:
        return best[1]
    return None
