"""FAL.ai image/video generation adapter.

Thin httpx-based async client over the FAL queue REST API:
  POST   https://queue.fal.run/{model_id}                            -> submit
  GET    https://queue.fal.run/{model_id}/requests/{rid}/status      -> poll status
  GET    https://queue.fal.run/{model_id}/requests/{rid}             -> fetch result

Auth: ``Authorization: Key $FAL_KEY``.

Public surface:
- :data:`SUPPORTED_MODELS`             -- registry of known models with kind + defaults.
- :func:`submit`                       -- submit a job, return request_id.
- :func:`poll`                         -- one-shot status poll.
- :func:`stream_generate`              -- async iterator yielding queue/progress events.
- :func:`estimate_cost`                -- rough USD cost estimate (heuristic, see notes).

This module never bakes secrets and never calls FAL when ``FAL_KEY`` is missing
(:func:`stream_generate` raises before issuing a request). It is fully async
and uses :class:`httpx.AsyncClient` for all I/O.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, AsyncIterator

import httpx
from dotenv import load_dotenv

load_dotenv(override=False)

logger = logging.getLogger(__name__)

FAL_QUEUE_BASE = "https://queue.fal.run"

# Polling cadence for stream_generate.
_POLL_INTERVAL_S = 1.5
_MAX_POLL_DURATION_S = 60 * 5  # 5 minutes hard ceiling
_HTTP_TIMEOUT_S = 30.0


# ---------------------------------------------------------------------------
# Supported models registry
# ---------------------------------------------------------------------------

# kind: 'image' | 'video'.
# default_params: applied as a base; caller params override per-key.
# Cost figures live in _COST_TABLE below; they are rough public-pricing
# estimates as of 2026-Q2 and exist only for the cost log -- not billing.
SUPPORTED_MODELS: dict[str, dict[str, Any]] = {
    "fal-ai/flux/dev": {
        "kind": "image",
        "default_params": {"image_size": "landscape_4_3", "num_inference_steps": 28},
    },
    "fal-ai/flux/schnell": {
        "kind": "image",
        "default_params": {"image_size": "landscape_4_3", "num_inference_steps": 4},
    },
    "fal-ai/flux-pro": {
        "kind": "image",
        "default_params": {"image_size": "landscape_4_3"},
    },
    "fal-ai/nano-banana": {
        "kind": "image",
        "default_params": {},
    },
    "fal-ai/sora-2": {
        "kind": "video",
        "default_params": {"duration": 5, "aspect_ratio": "16:9"},
    },
    "fal-ai/kling-video/v2/master": {
        "kind": "video",
        "default_params": {"duration": "5", "aspect_ratio": "16:9"},
    },
    "fal-ai/veo3": {
        "kind": "video",
        "default_params": {"duration": 8, "aspect_ratio": "16:9"},
    },
}

# Rough public-pricing snapshot used for the cost log only.
# Image rows are USD/image; video rows are USD/second.
# Update opportunistically -- treat as estimates, not invoices.
_COST_TABLE: dict[str, dict[str, float]] = {
    "fal-ai/flux/dev":              {"image": 0.025},
    "fal-ai/flux/schnell":          {"image": 0.003},
    "fal-ai/flux-pro":              {"image": 0.05},
    "fal-ai/nano-banana":           {"image": 0.04},
    "fal-ai/sora-2":                {"video_per_s": 0.30},
    "fal-ai/kling-video/v2/master": {"video_per_s": 0.28},
    "fal-ai/veo3":                  {"video_per_s": 0.50},
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _auth_headers() -> dict[str, str]:
    key = os.environ.get("FAL_KEY")
    if not key:
        raise RuntimeError(
            "FAL_KEY is not set. Configure it in the environment before calling FAL."
        )
    return {
        "Authorization": f"Key {key}",
        "Content-Type": "application/json",
    }


def _merge_params(model_id: str, params: dict[str, Any]) -> dict[str, Any]:
    """Layer caller params over the model's default params (immutable)."""
    spec = SUPPORTED_MODELS.get(model_id, {})
    defaults = dict(spec.get("default_params", {}))
    defaults.update(params or {})
    return defaults


def _normalize_status(payload: dict[str, Any]) -> str:
    """Normalize FAL status strings to the values we surface to clients."""
    raw = (payload.get("status") or "").upper()
    if raw in {"IN_QUEUE"}:
        return "queued"
    if raw in {"IN_PROGRESS"}:
        return "in_progress"
    if raw in {"COMPLETED", "OK"}:
        return "completed"
    if raw in {"ERROR", "FAILED"}:
        return "error"
    return raw.lower() or "unknown"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def submit(model_id: str, params: dict[str, Any]) -> str:
    """Submit a generation job to FAL's queue and return the request_id.

    Raises:
        RuntimeError: if FAL_KEY is missing.
        httpx.HTTPStatusError: if FAL returns a non-2xx status.
        KeyError: if FAL's response is malformed (no request_id).
    """
    body = _merge_params(model_id, params)
    url = f"{FAL_QUEUE_BASE}/{model_id}"
    logger.info("FAL submit model=%s params_keys=%s", model_id, sorted(body.keys()))
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
        resp = await client.post(url, json=body, headers=_auth_headers())
        resp.raise_for_status()
        data = resp.json()
    request_id = data.get("request_id") or data.get("requestId")
    if not request_id:
        raise KeyError(f"FAL response missing request_id: {data!r}")
    return str(request_id)


async def poll(request_id: str, model_id: str) -> dict[str, Any]:
    """One-shot status poll. Returns the parsed JSON.

    The status endpoint includes ``logs`` (optional) and ``status``. When the
    job is COMPLETED, callers should fetch the full result via :func:`fetch_result`.
    """
    url = f"{FAL_QUEUE_BASE}/{model_id}/requests/{request_id}/status"
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
        resp = await client.get(url, headers=_auth_headers(), params={"logs": "1"})
        resp.raise_for_status()
        return resp.json()


async def fetch_result(request_id: str, model_id: str) -> dict[str, Any]:
    """Fetch the final result payload for a completed request."""
    url = f"{FAL_QUEUE_BASE}/{model_id}/requests/{request_id}"
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
        resp = await client.get(url, headers=_auth_headers())
        resp.raise_for_status()
        return resp.json()


async def stream_generate(
    model_id: str,
    params: dict[str, Any],
) -> AsyncIterator[dict[str, Any]]:
    """Submit + poll, yielding lifecycle events.

    Events have shape::

        {
          "phase":    "queued" | "in_progress" | "completed" | "error",
          "progress": float,             # 0.0 .. 1.0 best-effort heuristic
          "result":   dict | None,       # populated only on 'completed'
          "logs":     list,              # accumulated FAL logs
        }

    Polling cadence is :data:`_POLL_INTERVAL_S` seconds, capped at
    :data:`_MAX_POLL_DURATION_S`. On timeout, an ``error`` phase is yielded.
    """
    if model_id not in SUPPORTED_MODELS:
        logger.warning("FAL model %s not in SUPPORTED_MODELS registry", model_id)

    request_id = await submit(model_id, params)
    yield {"phase": "queued", "progress": 0.05, "result": None, "logs": [], "request_id": request_id}

    started = asyncio.get_event_loop().time()
    poll_count = 0
    last_logs: list[Any] = []

    while True:
        if asyncio.get_event_loop().time() - started > _MAX_POLL_DURATION_S:
            yield {
                "phase": "error",
                "progress": 1.0,
                "result": None,
                "logs": last_logs,
                "error": "fal_poll_timeout",
            }
            return

        try:
            status = await poll(request_id, model_id)
        except httpx.HTTPError as exc:
            logger.exception("FAL poll failed: %s", exc)
            yield {
                "phase": "error",
                "progress": 1.0,
                "result": None,
                "logs": last_logs,
                "error": f"fal_poll_http_error: {exc}",
            }
            return

        phase = _normalize_status(status)
        last_logs = status.get("logs", last_logs) or last_logs
        poll_count += 1
        # Heuristic progress: scale poll count, never reach 1.0 until complete.
        progress = min(0.05 + 0.05 * poll_count, 0.9)

        if phase == "completed":
            try:
                result = await fetch_result(request_id, model_id)
            except httpx.HTTPError as exc:
                logger.exception("FAL fetch_result failed: %s", exc)
                yield {
                    "phase": "error",
                    "progress": 1.0,
                    "result": None,
                    "logs": last_logs,
                    "error": f"fal_fetch_http_error: {exc}",
                }
                return
            yield {
                "phase": "completed",
                "progress": 1.0,
                "result": result,
                "logs": last_logs,
            }
            return

        if phase == "error":
            yield {
                "phase": "error",
                "progress": 1.0,
                "result": None,
                "logs": last_logs,
                "error": status.get("error") or "fal_reported_error",
            }
            return

        # queued or in_progress
        yield {
            "phase": phase if phase in {"queued", "in_progress"} else "in_progress",
            "progress": progress,
            "result": None,
            "logs": last_logs,
        }
        await asyncio.sleep(_POLL_INTERVAL_S)


def estimate_cost(model_id: str, params: dict[str, Any]) -> float:
    """Estimate USD cost for a generation request.

    Heuristics (rough, public-pricing snapshot as of 2026-Q2):
    - Image models: flat USD/image times ``num_images`` (default 1).
    - Video models: USD/second times ``duration`` seconds (default 5).
    - Unknown models: return 0.0 and log a warning.

    These figures back the cost log only -- they are not billing-accurate.
    """
    pricing = _COST_TABLE.get(model_id)
    if not pricing:
        logger.warning("estimate_cost: no pricing row for model=%s", model_id)
        return 0.0

    spec = SUPPORTED_MODELS.get(model_id, {})
    kind = spec.get("kind", "image")

    if kind == "image":
        per_image = pricing.get("image", 0.0)
        n = int(params.get("num_images", 1) or 1)
        return round(per_image * max(n, 1), 6)

    if kind == "video":
        per_s = pricing.get("video_per_s", 0.0)
        duration = params.get("duration") or spec.get("default_params", {}).get("duration", 5)
        try:
            duration_s = float(duration)
        except (TypeError, ValueError):
            duration_s = 5.0
        return round(per_s * max(duration_s, 1.0), 6)

    return 0.0


def extract_artifact_url(result: dict[str, Any]) -> str | None:
    """Best-effort URL extraction from a completed FAL result payload.

    FAL response shapes vary by model; we try the common keys.
    """
    if not isinstance(result, dict):
        return None
    # Common shapes: {images: [{url}]}, {image: {url}}, {video: {url}}, {url}
    for key in ("images", "image", "video", "audio"):
        node = result.get(key)
        if isinstance(node, list) and node:
            first = node[0]
            if isinstance(first, dict) and first.get("url"):
                return str(first["url"])
        if isinstance(node, dict) and node.get("url"):
            return str(node["url"])
    if isinstance(result.get("url"), str):
        return result["url"]
    return None
