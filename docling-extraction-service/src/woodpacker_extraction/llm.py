"""LLM access layer: bounded concurrency, retries, caching, cost accounting.

Every LLM call in the extraction service goes through :func:`chat_invoke` so
that (Phase 19/20):

* concurrency is bounded (``LLM_CONCURRENCY``, default 4) — never unlimited;
* failures retry with exponential backoff + jitter (no arbitrary sleeps at
  call sites);
* identical requests are served from a content-addressed cache keyed by
  (model, prompt_version, messages hash) — publisher material re-uploaded by
  many users hits the cache instead of the provider;
* token usage and estimated cost are accumulated and reported.

The cache is an on-disk JSON store (safe for containers, no extra infra).
Set ``LLM_CACHE_DIR`` to relocate; ``LLM_CACHE=0`` disables caching.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import random
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

PROMPT_VERSION = "2026-08-v1"  # bump to invalidate cache when prompts change

# Rough USD price table per 1M tokens (input, output). Unknown models cost 0.
MODEL_PRICES: dict[str, tuple[float, float]] = {
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.50, 10.00),
    "deepseek-v4-flash-free": (0.0, 0.0),
}

_usage_lock = threading.Lock()
_usage_totals = {"prompt_tokens": 0, "completion_tokens": 0, "calls": 0, "estimated_cost_usd": 0.0}

_concurrency_slots = int(os.environ.get("LLM_CONCURRENCY", "4"))
_slot_semaphore = threading.BoundedSemaphore(_concurrency_slots)


def _cache_dir() -> Path:
    return Path(os.environ.get("LLM_CACHE_DIR", Path.home() / ".cache" / "woodpacker" / "llm"))


def _cache_enabled() -> bool:
    return os.environ.get("LLM_CACHE", "1") != "0"


def _cache_key(model: str, messages: list[Any]) -> str:
    payload = json.dumps(
        {"model": model, "v": PROMPT_VERSION, "m": _serialize_messages(messages)},
        sort_keys=True, ensure_ascii=False, default=str,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _serialize_messages(messages: list[Any]) -> list[Any]:
    out: list[Any] = []
    for m in messages:
        if hasattr(m, "content"):
            out.append({"role": getattr(m, "type", "msg"), "content": m.content})
        else:
            out.append(m)
    return out


def _cache_get(key: str) -> dict[str, Any] | None:
    if not _cache_enabled():
        return None
    path = _cache_dir() / f"{key}.json"
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        pass
    return None


def _cache_put(key: str, value: dict[str, Any]) -> None:
    if not _cache_enabled():
        return
    try:
        d = _cache_dir()
        d.mkdir(parents=True, exist_ok=True)
        tmp = d / f".{key}.{os.getpid()}.tmp"
        tmp.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
        tmp.replace(d / f"{key}.json")
    except Exception:  # noqa: BLE001
        logger.debug("LLM cache write failed", exc_info=True)


def record_usage(model: str, prompt_tokens: int, completion_tokens: int) -> None:
    in_price, out_price = MODEL_PRICES.get(model, (0.0, 0.0))
    cost = (prompt_tokens * in_price + completion_tokens * out_price) / 1_000_000
    with _usage_lock:
        _usage_totals["prompt_tokens"] += prompt_tokens
        _usage_totals["completion_tokens"] += completion_tokens
        _usage_totals["calls"] += 1
        _usage_totals["estimated_cost_usd"] += cost


def usage_snapshot() -> dict[str, Any]:
    with _usage_lock:
        return dict(_usage_totals)


def reset_usage() -> None:
    with _usage_lock:
        for k in _usage_totals:
            _usage_totals[k] = 0


def chat_invoke(
    model: Any,
    messages: list[Any],
    *,
    max_retries: int = 3,
    base_delay: float = 1.5,
    timeout_s: float = 90.0,
) -> Any:
    """Invoke a LangChain chat model with cache, bounded concurrency, retries.

    Raises the last exception only after all retries are exhausted.
    """
    model_name = getattr(model, "model_name", None) or os.environ.get("OPENCODE_MODEL", "unknown")

    key = _cache_key(str(model_name), messages)
    cached = _cache_get(key)
    if cached is not None:
        record_usage(model_name, 0, 0)  # cache hit — no provider cost
        return _rebuild_response(cached)

    def _is_retryable(exc: Exception) -> bool:
        msg = str(exc).lower()
        # 4xx client errors (auth, billing, bad model) never succeed on retry
        non_retryable = (
            "401" in msg
            or "402" in msg
            or "403" in msg
            or "422" in msg
            or "insufficient balance" in msg
            or "creditserror" in msg
            or "model is not supported" in msg
            or "model is unavailable" in msg
        )
        return not non_retryable

    def _attempt() -> Any:
        last_exc: Exception | None = None
        for attempt in range(max_retries):
            try:
                with _slot_semaphore:  # bounded concurrency — never unlimited
                    start = time.monotonic()
                    resp = model.invoke(messages)
                duration = time.monotonic() - start
                usage = getattr(resp, "usage_metadata", None) or {}
                record_usage(
                    model_name,
                    int(usage.get("input_tokens", 0)),
                    int(usage.get("output_tokens", 0)),
                )
                logger.debug("LLM call ok model=%s attempt=%d dur=%.1fs", model_name, attempt, duration)
                _cache_put(key, _serialize_response(resp))
                return resp
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                if not _is_retryable(exc):
                    logger.warning("LLM call failed (non-retryable): %s", exc)
                    raise
                delay = base_delay * (2**attempt) + random.uniform(0, 0.5)
                logger.warning(
                    "LLM call failed (attempt %d/%d): %s — retrying in %.1fs",
                    attempt + 1, max_retries, exc, delay,
                )
                time.sleep(delay)
        assert last_exc is not None
        raise last_exc

    return _attempt()


# ---------------------------------------------------------------------------
# Response (de)serialization for the disk cache
# ---------------------------------------------------------------------------

def _serialize_response(resp: Any) -> dict[str, Any]:
    usage = getattr(resp, "usage_metadata", None) or {}
    return {
        "content": _content_to_str(resp.content),
        "usage": usage,
        "cached_at": time.time(),
    }


def _content_to_str(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("text"):
                parts.append(str(block["text"]))
            elif isinstance(block, str):
                parts.append(block)
        return "\n".join(parts)
    return str(content or "")


class _CachedResponse:
    """Minimal stand-in for a LangChain AIMessage restored from cache."""

    def __init__(self, content: str, usage: dict[str, Any]):
        self.content = content
        self.usage_metadata = usage


def _rebuild_response(data: dict[str, Any]) -> _CachedResponse:
    return _CachedResponse(data.get("content", ""), data.get("usage", {}))


__all__ = [
    "PROMPT_VERSION",
    "chat_invoke",
    "record_usage",
    "usage_snapshot",
    "reset_usage",
    "MODEL_PRICES",
]
