"""Vision + text understanding layer using LangChain LLM APIs.

Stage 3 (image enrichment) and Stage 7 (Image Linking) supplements:
- ``describe_image``: when an exercise references an image (e.g. "Beschreiben
  Sie das Bild"), use vision understanding (NOT OCR) to describe its content.
- ``classify_exercise_type``: classify an exercise prompt into one of the
  15 spec exercise types (multiple_choice, fill_blank, listening, ...).
- ``classify_image_exercise``: analyze an image+exercise pair for
  exercise type and speaking/writing flags.

Transport is LangChain's ``ChatOpenAI`` (``langchain_openai``), pointed at the
OpenCode / OpenRouter-compatible endpoint configured via:
* ``OPENCODE_API_URL``  -> defaults to ``https://openrouter.ai/api/v1``
* ``OPENCODE_API_KEY``  -> bearer token (required to call the LLM)
* ``OPENCODE_MODEL``    -> defaults to ``deepseek-v4-flash-free``

All functions degrade gracefully: without an API key or on any API error they
return None (callers fall back to heuristics).
"""

from __future__ import annotations

import base64
import json
import logging
import os

from langchain_core.messages import HumanMessage

from .prompt import get_chat_model, get_vision_model, opencode_configured

logger = logging.getLogger(__name__)

EXERCISE_TYPES = (
    "multiple_choice",
    "fill_blank",
    "listening",
    "video_comprehension",
    "reading_comprehension",
    "matching",
    "sentence_building",
    "translation",
    "vocabulary",
    "grammar",
    "dialogue_completion",
    "speaking",
    "pronunciation",
    "writing",
    "open_ended",
)


def _image_data_url(image_data: bytes, mime_type: str = "image/png") -> str:
    b64 = base64.b64encode(image_data).decode("utf-8")
    return f"data:{mime_type};base64,{b64}"


def describe_image(
    image_data: bytes,
    prompt: str = "Describe this image in detail for a language learning exercise.",
    mime_type: str = "image/png",
) -> str | None:
    """Use an LLM vision model to describe an image (via LangChain ChatOpenAI).

    Returns:
        Image description string, or None if the vision API is unavailable.
    """
    if not opencode_configured():
        logger.warning("No API key configured for vision model")
        return None

    try:
        model = get_vision_model()
        data_url = _image_data_url(image_data, mime_type)
        resp = model.invoke([
            HumanMessage(content=[
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": data_url}},
            ])
        ])
        content = resp.content
        if isinstance(content, list):
            content = " ".join(
                part.get("text", "") for part in content if isinstance(part, dict)
            )
        return content.strip() if content else None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Vision API failed: %s", exc)
        return None


def _invoke_json(prompt: str) -> dict | None:
    """Invoke the LLM and parse a strict JSON object reply."""
    if not opencode_configured():
        return None
    try:
        model = get_chat_model()
        resp = model.invoke([HumanMessage(content=prompt)])
        content = resp.content
        if isinstance(content, list):
            content = " ".join(
                part.get("text", "") for part in content if isinstance(part, dict)
            )
        if not content:
            return None
        text = content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        return json.loads(text)
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM JSON call failed: %s", exc)
        return None


def classify_exercise_type(exercise_prompt: str) -> dict | None:
    """Classify an exercise prompt into one of the 15 spec exercise types.

    Returns a dict like {"exercise_type": "listening", "confidence": 0.92}
    or None when the LLM is unavailable.
    """
    type_list = ", ".join(EXERCISE_TYPES)
    prompt = (
        "Classify this language-learning exercise prompt into exactly one of: "
        f"{type_list}. Consider German keywords (Hören→listening, "
        "Ergänzen Sie/_____→fill_blank, Wählen Sie a/b/c→multiple_choice, "
        "Sprechen→speaking, Schreiben→writing, Übersetzen→translation, "
        "Lesen→reading_comprehension, Video→video_comprehension, Zuordnen→matching, "
        "Grammatik→grammar, Vokabeln→vocabulary, Aussprache→pronunciation, "
        "Dialog→dialogue_completion, Satz→sentence_building). "
        "Return ONLY JSON: {\"exercise_type\": \"...\", \"confidence\": 0.0}. "
        f"Exercise prompt: '{exercise_prompt[:800]}'"
    )
    result = _invoke_json(prompt)
    if not result or result.get("exercise_type") not in EXERCISE_TYPES:
        if result and result.get("exercise_type"):
            logger.warning("LLM returned unknown exercise_type: %s", result.get("exercise_type"))
            return None
        return None
    return result


def classify_image_exercise(
    image_data: bytes,
    exercise_prompt: str,
    mime_type: str = "image/png",
) -> dict | None:
    """Analyze an image+exercise pair to determine the exercise type.

    Returns structured JSON:
    {
        "exercise_type": "image_description",
        "speaking": true,
        "writing": true,
        "image_reference": true
    }
    """
    prompt = (
        "Analyze this image and the exercise prompt. Determine the exercise type "
        "and whether it involves speaking, writing, or image description. "
        "Return ONLY JSON: {\"exercise_type\": \"...\", \"speaking\": true/false, "
        "\"writing\": true/false, \"image_reference\": true/false}. "
        f"Exercise prompt: '{exercise_prompt}'"
    )
    if not opencode_configured():
        return None
    try:
        model = get_vision_model()
        data_url = _image_data_url(image_data, mime_type)
        resp = model.invoke([
            HumanMessage(content=[
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": data_url}},
            ])
        ])
        content = resp.content
        if isinstance(content, list):
            content = " ".join(
                part.get("text", "") for part in content if isinstance(part, dict)
            )
        if not content:
            return None
        text = content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        return json.loads(text)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Vision exercise classification failed: %s", exc)
        return None


def enrich_image_batch(
    images: list,
) -> None:
    """Best-effort: describe every image in-place (sets ``description`` attr).

    ``images`` is a list of :class:`~woodpacker_extraction.extractor.ExtractedImage`.
    Failures are logged, never raised.
    """
    for img in images:
        if getattr(img, "description", None):
            continue
        desc = describe_image(
            img.data,
            prompt="Describe this image in detail for a language learning exercise. "
                   "Include any visible text, people, scenes, and captions.",
            mime_type=f"image/{img.ext.lstrip('.')}" if not img.ext.startswith(".") else f"image/{img.ext[1:]}",
        )
        img.description = desc


__all__ = [
    "EXERCISE_TYPES",
    "describe_image",
    "classify_exercise_type",
    "classify_image_exercise",
    "enrich_image_batch",
]