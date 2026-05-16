"""Generation router (WS-C).

Streams an SSE response for ``POST /api/generate``:

  - phase events:    ``{"type": "phase",    "phase": ..., "progress": float}``
  - artifact event:  ``{"type": "artifact", "artifact": Artifact}``  (once)
  - error event:     ``{"type": "error",    "message": str}``         (on failure)

Routes:
  - ``model.startswith("openai/")`` -> :mod:`adapters_gen.openai_image` (stills only).
  - everything else                 -> :func:`adapters_gen.fal.stream_generate`.

Side-effect: appends a JSONL row to ``fixtures/cost-log.jsonl`` once per
completed (or attempted) generation, with ``ts``, ``run_id``, ``model``,
``params`` and ``cost_usd``.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterator

from fastapi import APIRouter

from adapters_gen import fal, openai_image
from schemas import Artifact, GenerateRequest
from sse import event_stream

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/generate", tags=["generate"])

# fixtures/cost-log.jsonl lives at the repo root.
# This file: services/api/routers/generate.py
# Repo root: ../../../
_REPO_ROOT = Path(__file__).resolve().parents[3]
_COST_LOG_PATH = _REPO_ROOT / "fixtures" / "cost-log.jsonl"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _append_cost_log(entry: dict[str, Any]) -> None:
    """Append one JSONL row to fixtures/cost-log.jsonl (best-effort)."""
    try:
        _COST_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with _COST_LOG_PATH.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, default=str) + "\n")
    except OSError as exc:  # pragma: no cover - filesystem failure is non-fatal
        logger.warning("Failed to append cost-log entry: %s", exc)


def _phase_event(phase: str, progress: float) -> dict[str, Any]:
    return {"type": "phase", "phase": phase, "progress": round(float(progress), 4)}


def _error_event(message: str) -> dict[str, Any]:
    return {"type": "error", "message": message}


def _artifact_event(artifact: Artifact) -> dict[str, Any]:
    return {"type": "artifact", "artifact": artifact.model_dump(by_alias=True)}


def _build_artifact(
    *,
    kind: str,
    url: str | None,
    name: str,
    source: str,
    cost_usd: float | None,
    meta: dict[str, Any] | None = None,
) -> Artifact:
    now = _now_iso()
    return Artifact(
        id=f"art_{uuid.uuid4().hex[:12]}",
        kind=kind,  # type: ignore[arg-type]
        url=url,
        name=name,
        source=source,
        createdAt=now,
        updatedAt=now,
        meta=meta or {},
        costUsd=cost_usd,
    )


# ---------------------------------------------------------------------------
# Per-provider streaming generators
# ---------------------------------------------------------------------------

async def _stream_fal(
    req: GenerateRequest,
    run_id: str,
) -> AsyncIterator[dict[str, Any]]:
    cost_estimate = fal.estimate_cost(req.model, req.params)
    last_phase = "queued"
    completed_result: dict[str, Any] | None = None

    try:
        async for event in fal.stream_generate(req.model, req.params):
            phase = event.get("phase", "in_progress")
            progress = float(event.get("progress", 0.0))

            if phase == "error":
                msg = str(event.get("error") or "fal_error")
                yield _phase_event("error", 1.0)
                yield _error_event(msg)
                _append_cost_log({
                    "ts": _now_iso(),
                    "run_id": run_id,
                    "model": req.model,
                    "params": req.params,
                    "cost_usd": 0.0,
                    "status": "error",
                    "error": msg,
                })
                return

            if phase == "completed":
                completed_result = event.get("result")
                last_phase = "running"  # emit final 'running' before 'completed'
                yield _phase_event("running", min(progress, 0.99))
                break

            # Map fal phases (queued | in_progress) -> public phases
            public_phase = "queued" if phase == "queued" else "running"
            last_phase = public_phase
            yield _phase_event(public_phase, progress)

    except RuntimeError as exc:
        # Missing FAL_KEY etc.
        yield _phase_event("error", 1.0)
        yield _error_event(str(exc))
        _append_cost_log({
            "ts": _now_iso(),
            "run_id": run_id,
            "model": req.model,
            "params": req.params,
            "cost_usd": 0.0,
            "status": "error",
            "error": str(exc),
        })
        return
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("FAL generation failed: %s", exc)
        yield _phase_event("error", 1.0)
        yield _error_event(f"fal_unexpected_error: {exc}")
        _append_cost_log({
            "ts": _now_iso(),
            "run_id": run_id,
            "model": req.model,
            "params": req.params,
            "cost_usd": 0.0,
            "status": "error",
            "error": str(exc),
        })
        return

    # Build artifact from result
    url = fal.extract_artifact_url(completed_result or {}) if completed_result else None
    artifact = _build_artifact(
        kind=req.kind,
        url=url,
        name=f"{req.model.split('/')[-1]}-{run_id[:6]}",
        source=req.model,
        cost_usd=cost_estimate,
        meta={"raw": completed_result, "run_id": run_id},
    )
    yield _phase_event("completed", 1.0)
    yield _artifact_event(artifact)
    _append_cost_log({
        "ts": _now_iso(),
        "run_id": run_id,
        "model": req.model,
        "params": req.params,
        "cost_usd": cost_estimate,
        "status": "completed",
    })
    # last_phase reference avoids "unused" lints in static checkers
    logger.debug("FAL stream finalized phase=%s", last_phase)


async def _stream_openai_image(
    req: GenerateRequest,
    run_id: str,
) -> AsyncIterator[dict[str, Any]]:
    if req.kind != "image":
        yield _phase_event("error", 1.0)
        yield _error_event("openai/* models support stills (kind='image') only")
        return

    yield _phase_event("queued", 0.05)
    yield _phase_event("running", 0.4)

    # model="openai/gpt-image-1" -> "gpt-image-1"
    openai_model = req.model.split("/", 1)[1] if "/" in req.model else req.model
    size = str(req.params.get("size", "1024x1024"))
    quality = str(req.params.get("quality", "standard"))
    prompt = str(req.params.get("prompt", "")).strip()

    if not prompt:
        yield _phase_event("error", 1.0)
        yield _error_event("params.prompt is required for openai/* models")
        return

    try:
        result = await openai_image.generate(
            prompt=prompt, size=size, quality=quality, model=openai_model,
        )
    except (RuntimeError, ValueError) as exc:
        logger.warning("OpenAI image generation rejected: %s", exc)
        yield _phase_event("error", 1.0)
        yield _error_event(str(exc))
        _append_cost_log({
            "ts": _now_iso(),
            "run_id": run_id,
            "model": req.model,
            "params": req.params,
            "cost_usd": 0.0,
            "status": "error",
            "error": str(exc),
        })
        return
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("OpenAI image generation failed: %s", exc)
        yield _phase_event("error", 1.0)
        yield _error_event(f"openai_unexpected_error: {exc}")
        _append_cost_log({
            "ts": _now_iso(),
            "run_id": run_id,
            "model": req.model,
            "params": req.params,
            "cost_usd": 0.0,
            "status": "error",
            "error": str(exc),
        })
        return

    cost_usd = float(result.get("cost_usd") or 0.0)
    artifact = _build_artifact(
        kind="image",
        url=result.get("url"),
        name=f"openai-{run_id[:6]}",
        source=f"openai/{openai_model}",
        cost_usd=cost_usd,
        meta={
            "size": size,
            "quality": quality,
            "revised_prompt": result.get("revised_prompt"),
            "b64_json_present": bool(result.get("b64_json")),
            "run_id": run_id,
        },
    )
    yield _phase_event("completed", 1.0)
    yield _artifact_event(artifact)
    _append_cost_log({
        "ts": _now_iso(),
        "run_id": run_id,
        "model": req.model,
        "params": req.params,
        "cost_usd": cost_usd,
        "status": "completed",
    })


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

async def _stream(req: GenerateRequest) -> AsyncIterator[dict[str, Any]]:
    run_id = uuid.uuid4().hex
    logger.info(
        "Generate request run_id=%s kind=%s model=%s params_keys=%s",
        run_id, req.kind, req.model, sorted(req.params.keys()),
    )
    if req.model.startswith("openai/"):
        async for evt in _stream_openai_image(req, run_id):
            yield evt
    else:
        async for evt in _stream_fal(req, run_id):
            yield evt


@router.post("")
async def generate(req: GenerateRequest):
    """Stream generation events as SSE."""
    return event_stream(_stream(req))


@router.get("/models")
async def list_models() -> dict[str, Any]:
    """Static registry of FAL-supported models. Useful for the canvas UI."""
    return {
        "fal": fal.SUPPORTED_MODELS,
        "openai": {
            "openai/gpt-image-1": {
                "kind": "image",
                "default_params": {"size": "1024x1024", "quality": "standard"},
            },
        },
        "cost_log_path": str(_COST_LOG_PATH),
        "fal_key_present": bool(os.environ.get("FAL_KEY")),
        "openai_key_present": bool(os.environ.get("OPENAI_API_KEY")),
    }
