"""Performance Analyst node — runs the Virality Predictor stub.

Once WS-F lands ``POST /api/score``, this node will call it. For now we return
a deterministic-looking fake score so the rest of the pipeline can flow.
"""

from __future__ import annotations

import os
from typing import Any

import httpx

from ..contract import AgentSpec

INSTRUCTIONS = """You are a performance analyst.
You score creative output across viral, hook, and hold-rate dimensions.
This node currently delegates to /api/score (heuristic + LLM critique).
"""

_AGENT = AgentSpec(
    id="analyst",
    name="Performance Analyst",
    role="analyst",
    instructions=INSTRUCTIONS,
    adapter_type="pioneer",
)

_FAKE_SCORE: dict[str, Any] = {"viral": 70, "hook": 65, "hold": 80}


async def forward(state: dict[str, Any], _runtime: Any) -> dict[str, Any]:
    api_base = os.environ.get("API_BASE_URL", "").strip()
    score: dict[str, Any] = dict(_FAKE_SCORE)

    if api_base:
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=2.0)) as client:
                resp = await client.post(
                    f"{api_base.rstrip('/')}/api/score",
                    json={
                        "headlines": state.get("headlines", []),
                        "hooks": state.get("hooks", []),
                        "format": state.get("format"),
                    },
                )
                if resp.status_code < 400:
                    score = resp.json()
        except httpx.HTTPError:
            # WS-F not up yet — fall through to fake score.
            score = dict(_FAKE_SCORE)

    return {**state, "score": score}


__all__ = ["INSTRUCTIONS", "forward"]
