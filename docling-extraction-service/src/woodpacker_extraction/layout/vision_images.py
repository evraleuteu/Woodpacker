"""Stage 6: Image understanding — vision applied ONLY to image blocks.

Never whole pages. Each image block crop goes to the vision model once,
asking for a description plus keywords as strict JSON. Bounded by
``IMAGE_VISION_MAX_PER_DOC`` (default 12); beyond the budget, blocks keep
their deterministic fallback description ("image on page N").
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from .types import ImageUnderstanding, LayoutBlock

logger = logging.getLogger(__name__)


def vision_budget() -> int:
    return int(os.environ.get("IMAGE_VISION_MAX_PER_DOC", "12"))


def understand_images(
    image_blocks: list[LayoutBlock],
    crops: dict[str, Any],
) -> tuple[list[ImageUnderstanding], int]:
    """Describe image blocks. Returns (understandings, llm_calls_used)."""
    out: list[ImageUnderstanding] = []
    calls = 0
    if not os.environ.get("OPENCODE_API_KEY"):
        # Deterministic offline fallback: no hallucinated descriptions.
        return [_fallback(block) for block in image_blocks], 0

    model = None
    try:
        from ..prompt import get_vision_model, opencode_configured

        model = get_vision_model() if opencode_configured() else None
    except Exception:  # noqa: BLE001
        model = None

    for block in image_blocks:
        crop = crops.get(block.block_id)
        if model is None or crop is None or calls >= vision_budget():
            out.append(_fallback(block))
            continue
        calls += 1
        result = _describe_with_keywords(model, crop)
        if result:
            out.append(
                ImageUnderstanding(
                    image_id=block.block_id,
                    description=result["description"],
                    keywords=result["keywords"],
                    engine="vision",
                )
            )
        else:
            out.append(_fallback(block))
    return out, calls


def _fallback(block: LayoutBlock) -> ImageUnderstanding:
    return ImageUnderstanding(
        image_id=block.block_id,
        description=f"Image on page {block.page}",
        keywords=[],
        engine="fallback",
    )


def _describe_with_keywords(model: Any, crop: Any) -> dict[str, Any] | None:
    import base64
    import io

    from langchain_core.messages import HumanMessage

    try:
        buf = io.BytesIO()
        thumb = crop.copy()
        thumb.thumbnail((1024, 1024))
        thumb.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        resp = model.invoke([
            HumanMessage(content=[
                {"type": "text", "text": (
                    "Describe this textbook image for a language-learning exercise index. "
                    'Return ONLY JSON: {"description": "<= 25 words", '
                    '"keywords": [3-6 short lowercase nouns]}.'
                )},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
            ])
        ])
        content = resp.content
        if isinstance(content, list):
            content = " ".join(p.get("text", "") for p in content if isinstance(p, dict))
        text = str(content or "").strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        data = json.loads(text)
        description = str(data.get("description") or "").strip()
        keywords = [str(k).lower().strip() for k in (data.get("keywords") or [])][:8]
        if not description:
            return None
        return {"description": description, "keywords": [k for k in keywords if k]}
    except Exception as exc:  # noqa: BLE001
        logger.debug("Image understanding failed: %s", exc)
        return None
