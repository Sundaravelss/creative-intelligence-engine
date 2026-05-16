"""Unit tests for the generate router (WS-C).

We never call FAL or OpenAI live: each path replaces the adapter call with an
in-memory async generator / coroutine. The goal is to lock the public SSE
event sequence ('phase' x N -> 'artifact' once OR 'phase'(error) -> 'error')
so future refactors can't silently break the contract the frontend depends on.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any, AsyncIterator

import pytest

# Make the api package importable when tests run from services/api/.
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from adapters_gen import fal as fal_module  # noqa: E402
from adapters_gen import openai_image as openai_image_module  # noqa: E402
from routers import generate as generate_router  # noqa: E402
from schemas import GenerateRequest  # noqa: E402


async def _drain(req: GenerateRequest) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    async for evt in generate_router._stream(req):
        out.append(evt)
    return out


def _types(events: list[dict[str, Any]]) -> list[str]:
    return [e["type"] for e in events]


# ---------------------------------------------------------------------------
# FAL happy path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_fal_happy_path_emits_phases_then_artifact(monkeypatch, tmp_path):
    # Redirect cost log to a temp file so the test does not pollute fixtures/.
    monkeypatch.setattr(generate_router, "_COST_LOG_PATH", tmp_path / "cost.jsonl")

    fake_result = {"images": [{"url": "https://cdn.fal.example/out.png"}]}

    async def fake_stream(model_id: str, params: dict[str, Any]) -> AsyncIterator[dict[str, Any]]:
        yield {"phase": "queued",      "progress": 0.05, "result": None,        "logs": []}
        yield {"phase": "in_progress", "progress": 0.4,  "result": None,        "logs": []}
        yield {"phase": "completed",   "progress": 1.0,  "result": fake_result, "logs": []}

    monkeypatch.setattr(fal_module, "stream_generate", fake_stream)
    # estimate_cost is a sync function -- replace with a stub so we don't depend
    # on the live pricing table.
    monkeypatch.setattr(fal_module, "estimate_cost", lambda m, p: 0.025)

    req = GenerateRequest(kind="image", model="fal-ai/flux/dev", params={"prompt": "red sneaker"})
    events = await _drain(req)

    types = _types(events)
    assert types.count("artifact") == 1, f"expected exactly one artifact, got {types}"
    assert types[-1] == "artifact"
    assert "phase" in types
    # Final phase before artifact must be 'completed'
    completed_idx = next(i for i, e in enumerate(events) if e.get("type") == "phase" and e.get("phase") == "completed")
    artifact_idx = next(i for i, e in enumerate(events) if e["type"] == "artifact")
    assert completed_idx < artifact_idx

    artifact = events[artifact_idx]["artifact"]
    assert artifact["url"] == "https://cdn.fal.example/out.png"
    assert artifact["kind"] == "image"
    assert artifact["costUsd"] == 0.025

    # Cost log got one line
    log_lines = (tmp_path / "cost.jsonl").read_text().strip().splitlines()
    assert len(log_lines) == 1


# ---------------------------------------------------------------------------
# FAL error path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_fal_error_emits_error_event_no_artifact(monkeypatch, tmp_path):
    monkeypatch.setattr(generate_router, "_COST_LOG_PATH", tmp_path / "cost.jsonl")

    async def fake_stream(model_id: str, params: dict[str, Any]) -> AsyncIterator[dict[str, Any]]:
        yield {"phase": "queued", "progress": 0.05, "result": None, "logs": []}
        yield {"phase": "error",  "progress": 1.0,  "result": None, "logs": [], "error": "boom"}

    monkeypatch.setattr(fal_module, "stream_generate", fake_stream)
    monkeypatch.setattr(fal_module, "estimate_cost", lambda m, p: 0.0)

    req = GenerateRequest(kind="image", model="fal-ai/flux/dev", params={})
    events = await _drain(req)

    types = _types(events)
    assert "artifact" not in types
    assert types[-1] == "error"
    assert events[-1]["message"] == "boom"


# ---------------------------------------------------------------------------
# OpenAI fallback path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_openai_image_route(monkeypatch, tmp_path):
    monkeypatch.setattr(generate_router, "_COST_LOG_PATH", tmp_path / "cost.jsonl")

    async def fake_generate(prompt: str, size: str = "1024x1024", quality: str = "standard", model: str = "gpt-image-1"):
        return {
            "url": "https://oai.example/img.png",
            "b64_json": None,
            "cost_usd": 0.04,
            "model": model,
            "size": size,
            "quality": quality,
            "revised_prompt": None,
        }

    monkeypatch.setattr(openai_image_module, "generate", fake_generate)

    req = GenerateRequest(
        kind="image",
        model="openai/gpt-image-1",
        params={"prompt": "studio shot of a red sneaker"},
    )
    events = await _drain(req)

    types = _types(events)
    assert types[-1] == "artifact"
    artifact = events[-1]["artifact"]
    assert artifact["url"] == "https://oai.example/img.png"
    assert artifact["source"] == "openai/gpt-image-1"


# ---------------------------------------------------------------------------
# OpenAI rejects video kind
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_openai_rejects_video_kind(monkeypatch, tmp_path):
    monkeypatch.setattr(generate_router, "_COST_LOG_PATH", tmp_path / "cost.jsonl")
    req = GenerateRequest(kind="video", model="openai/gpt-image-1", params={"prompt": "x"})
    events = await _drain(req)
    assert _types(events)[-1] == "error"
    assert "stills" in events[-1]["message"].lower()


# ---------------------------------------------------------------------------
# FAL adapter unit checks (no HTTP)
# ---------------------------------------------------------------------------

def test_fal_supported_models_includes_required_ids():
    required = {
        "fal-ai/flux/dev",
        "fal-ai/flux/schnell",
        "fal-ai/flux-pro",
        "fal-ai/sora-2",
        "fal-ai/kling-video/v2/master",
        "fal-ai/veo3",
        "fal-ai/nano-banana",
    }
    assert required.issubset(fal_module.SUPPORTED_MODELS.keys())


def test_fal_estimate_cost_image_and_video():
    img_cost = fal_module.estimate_cost("fal-ai/flux/dev", {})
    assert img_cost > 0
    vid_cost = fal_module.estimate_cost("fal-ai/sora-2", {"duration": 10})
    assert vid_cost > 0
    # Unknown model -> 0
    assert fal_module.estimate_cost("fal-ai/no-such-model", {}) == 0.0


def test_fal_submit_requires_key(monkeypatch):
    monkeypatch.delenv("FAL_KEY", raising=False)

    async def run() -> None:
        with pytest.raises(RuntimeError):
            await fal_module.submit("fal-ai/flux/dev", {"prompt": "x"})

    asyncio.run(run())


def test_fal_extract_artifact_url_handles_shapes():
    assert fal_module.extract_artifact_url({"images": [{"url": "u1"}]}) == "u1"
    assert fal_module.extract_artifact_url({"video": {"url": "u2"}}) == "u2"
    assert fal_module.extract_artifact_url({"url": "u3"}) == "u3"
    assert fal_module.extract_artifact_url({}) is None
