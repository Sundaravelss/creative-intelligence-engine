"""Unit tests for CampaignGraph and the runtime fallback chain.

These tests mock the adapter runtime so they run offline without API keys.
"""

from __future__ import annotations

import json
from typing import Any

import pytest

# Run as a flat package — `services/agents` doubles as the import root.
import sys
from pathlib import Path

_AGENTS_PARENT = Path(__file__).resolve().parent.parent.parent
if str(_AGENTS_PARENT) not in sys.path:
    sys.path.insert(0, str(_AGENTS_PARENT))

from agents.contract import (  # noqa: E402
    AdapterExecutionContext,
    AdapterExecutionResult,
)
from agents.orchestrator import CampaignGraph  # noqa: E402


class FakeRuntime:
    """Returns canned JSON suitable for each node's prompt heuristically."""

    def __init__(self) -> None:
        self.calls: list[AdapterExecutionContext] = []

    async def execute(self, ctx: AdapterExecutionContext) -> AdapterExecutionResult:
        self.calls.append(ctx)
        role = ctx.agent.role
        if role == "strategist":
            text = json.dumps(
                {
                    "audience": "Gen-Z urban sneakerheads",
                    "hooks": ["Drop alert", "Limited run", "Streetwear icon"],
                }
            )
        elif role == "creative_director":
            text = json.dumps(
                {
                    "format_mix": ["reel_9_16", "square_1_1"],
                    "budget_per_asset_usd": 0.75,
                }
            )
        elif role == "copywriter":
            text = json.dumps(
                {
                    "items": [
                        {"hook": "Drop alert", "headline": "Limited drop", "cta": "Shop"},
                        {"hook": "Limited run", "headline": "Only 200 pairs", "cta": "Grab"},
                    ]
                }
            )
        elif role == "art_director":
            text = json.dumps(
                {
                    "references": ["lifestyle street shot"],
                    "image_model": "fal-ai/flux/dev",
                    "video_model": "fal-ai/sora-2",
                    "params": {"aspect_ratio": "9:16", "style": "editorial"},
                }
            )
        else:
            text = "{}"
        return AdapterExecutionResult(exit_code=0, result_json={"text": text})


@pytest.mark.asyncio
async def test_campaign_graph_emits_full_event_sequence() -> None:
    runtime = FakeRuntime()
    graph = CampaignGraph(
        brief={"keyword": "sneakers"},
        brand={"name": "Acme"},
        runtime=runtime,
        format="reel",
    )

    events: list[dict[str, Any]] = []
    async for evt in graph.run():
        events.append(evt)

    types = [e["type"] for e in events]
    assert types[0] == "run_start"
    assert types[-1] == "done"
    # 6 nodes: strategist, creative_director, parallel(copy+art), analyst, publisher
    assert types.count("node_start") == 5
    assert types.count("node_complete") == 5
    assert any(t == "artifact" for t in types)


@pytest.mark.asyncio
async def test_campaign_graph_emits_at_least_six_events() -> None:
    runtime = FakeRuntime()
    graph = CampaignGraph(brief={}, brand={}, runtime=runtime)
    count = 0
    async for _ in graph.run():
        count += 1
    assert count >= 6


@pytest.mark.asyncio
async def test_strategist_falls_back_when_runtime_returns_garbage() -> None:
    class GarbageRuntime:
        async def execute(self, _ctx: AdapterExecutionContext) -> AdapterExecutionResult:
            return AdapterExecutionResult(exit_code=0, result_json={"text": "not json"})

    graph = CampaignGraph(
        brief={"keyword": "coffee"},
        brand={},
        runtime=GarbageRuntime(),
        format="square",
    )
    events = [evt async for evt in graph.run()]
    # Pipeline must still complete with fallback content.
    assert events[-1]["type"] == "done"


@pytest.mark.asyncio
async def test_runtime_fallback_chain(monkeypatch: pytest.MonkeyPatch) -> None:
    """Runtime should advance to the next adapter when one raises."""
    from agents import registry, runtime as agent_runtime
    from agents.contract import AgentSpec, RuntimeState

    calls: list[str] = []

    async def boom(_ctx: AdapterExecutionContext) -> AdapterExecutionResult:
        calls.append("boom")
        raise RuntimeError("nope")

    async def ok(_ctx: AdapterExecutionContext) -> AdapterExecutionResult:
        calls.append("ok")
        return AdapterExecutionResult(exit_code=0, result_json={"text": "ok"})

    registry.register("boom", boom)
    registry.register("ok", ok)
    monkeypatch.setenv("ADAPTER_FALLBACK_CHAIN", "ok")

    ctx = AdapterExecutionContext(
        run_id="t",
        agent=AgentSpec(
            id="a", name="a", role="r", instructions="", adapter_type="boom"
        ),
        runtime=RuntimeState(),
        config={"adapter": "boom"},
    )
    result = await agent_runtime.execute(ctx)
    assert result.exit_code == 0
    assert calls == ["boom", "ok"]


def test_registry_has_expected_adapters() -> None:
    from agents import registry

    names = set(registry.names())
    # Five canonical adapters + one deprecated alias.
    assert names >= {
        "pioneer",
        "openai",
        "claude_code",
        "hermes_cli",
        "together",
    }
    # Backwards-compat alias kept until next release.
    assert "hermes" in names
