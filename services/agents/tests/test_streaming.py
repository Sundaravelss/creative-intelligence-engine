"""Streaming tests for CampaignGraph.

The orchestrator wires `ctx.on_log("stdout", chunk)` callbacks from each node
through an asyncio.Queue and re-emits them as `text_delta` / `text_done`
events so the chat UI can render reasoning progressively. This module covers
the contract:

  - chunks pushed by an adapter become text_delta events in order
  - text_done fires once per node before node_complete
  - the parallel copywriter+art_director step interleaves chunks but emits
    one text_done per node
  - if an adapter never streams (e.g. analyst's HTTP-only path) we still get
    a text_done with empty fullText, never silence
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import pytest

_AGENTS_PARENT = Path(__file__).resolve().parent.parent.parent
if str(_AGENTS_PARENT) not in sys.path:
    sys.path.insert(0, str(_AGENTS_PARENT))

from agents.contract import (  # noqa: E402
    AdapterExecutionContext,
    AdapterExecutionResult,
)
from agents.orchestrator import CampaignGraph  # noqa: E402


class StreamingFakeRuntime:
    """Adapter that pushes 5 chunks via on_log before returning final JSON."""

    def __init__(self) -> None:
        self.calls: list[str] = []

    async def execute(self, ctx: AdapterExecutionContext) -> AdapterExecutionResult:
        self.calls.append(ctx.agent.role)
        role = ctx.agent.role
        # Stream 5 reasoning chunks per LLM call. Avoid leading "[" so the
        # orchestrator doesn't filter them as bracketed status lines.
        if ctx.on_log is not None:
            for i in range(5):
                await ctx.on_log("stdout", f"{role}-tok{i} ")

        if role == "strategist":
            text = json.dumps(
                {"audience": "Test audience", "hooks": ["A", "B", "C"]}
            )
        elif role == "creative_director":
            text = json.dumps(
                {"format_mix": ["reel_9_16"], "budget_per_asset_usd": 1.0}
            )
        elif role == "copywriter":
            text = json.dumps(
                {"items": [{"hook": "A", "headline": "h", "cta": "c"}]}
            )
        elif role == "art_director":
            text = json.dumps(
                {
                    "references": ["ref"],
                    "image_model": "fal-ai/flux/dev",
                    "video_model": "fal-ai/sora-2",
                    "params": {"aspect_ratio": "9:16", "style": "x"},
                }
            )
        else:
            text = "{}"
        return AdapterExecutionResult(exit_code=0, result_json={"text": text})


@pytest.mark.asyncio
async def test_strategist_emits_5_text_deltas_before_text_done() -> None:
    runtime = StreamingFakeRuntime()
    graph = CampaignGraph(
        brief={"keyword": "wool runners"},
        brand={},
        runtime=runtime,
        format="reel",
    )
    events: list[dict[str, Any]] = []
    async for evt in graph.run():
        events.append(evt)

    strategist_deltas = [
        e for e in events if e.get("type") == "text_delta" and e.get("nodeId") == "strategist"
    ]
    strategist_done = [
        e for e in events if e.get("type") == "text_done" and e.get("nodeId") == "strategist"
    ]
    strategist_complete = [
        e
        for e in events
        if e.get("type") == "node_complete" and e.get("node_id") == "strategist"
    ]

    assert len(strategist_deltas) == 5, f"expected 5 deltas, got {len(strategist_deltas)}"
    assert [d["chunk"] for d in strategist_deltas] == [
        "strategist-tok0 ",
        "strategist-tok1 ",
        "strategist-tok2 ",
        "strategist-tok3 ",
        "strategist-tok4 ",
    ]
    assert len(strategist_done) == 1
    assert strategist_done[0]["fullText"] == (
        "strategist-tok0 strategist-tok1 strategist-tok2 "
        "strategist-tok3 strategist-tok4 "
    )

    # Ordering: every delta must precede text_done, which must precede
    # node_complete.
    delta_indices = [i for i, e in enumerate(events) if e.get("type") == "text_delta" and e.get("nodeId") == "strategist"]
    done_index = events.index(strategist_done[0])
    complete_index = events.index(strategist_complete[0])
    assert max(delta_indices) < done_index < complete_index


@pytest.mark.asyncio
async def test_parallel_copywriter_and_art_director_each_emit_text_done() -> None:
    """The parallel step must emit one text_done per agent.

    Both adapters stream concurrently, so chunks may be interleaved — but
    each agent's deltas must be in order, and we get exactly two text_done
    events tagged with nodeId=copywriter and nodeId=art_director.
    """
    runtime = StreamingFakeRuntime()
    graph = CampaignGraph(
        brief={"keyword": "wool runners"},
        brand={},
        runtime=runtime,
        format="reel",
    )
    events = [evt async for evt in graph.run()]

    cw_deltas = [
        e for e in events if e.get("type") == "text_delta" and e.get("nodeId") == "copywriter"
    ]
    ad_deltas = [
        e for e in events if e.get("type") == "text_delta" and e.get("nodeId") == "art_director"
    ]
    cw_done = [
        e for e in events if e.get("type") == "text_done" and e.get("nodeId") == "copywriter"
    ]
    ad_done = [
        e for e in events if e.get("type") == "text_done" and e.get("nodeId") == "art_director"
    ]

    assert len(cw_deltas) == 5
    assert len(ad_deltas) == 5
    assert len(cw_done) == 1
    assert len(ad_done) == 1
    # Per-agent ordering preserved (chunks tagged tok0..tok4).
    assert [d["chunk"] for d in cw_deltas] == [
        f"copywriter-tok{i} " for i in range(5)
    ]
    assert [d["chunk"] for d in ad_deltas] == [
        f"art_director-tok{i} " for i in range(5)
    ]


@pytest.mark.asyncio
async def test_text_done_fires_even_without_any_deltas() -> None:
    """analyst + publisher don't call an LLM (no on_log callback fired).

    The chat still needs the text_done signal so the live_stream UI can
    transition cleanly. Empty fullText is fine.
    """

    class _NoStreamRuntime(StreamingFakeRuntime):
        async def execute(self, ctx):  # type: ignore[no-untyped-def]
            # DO NOT call ctx.on_log — simulates HTTP-only nodes.
            return await super().execute(ctx)

    # Override: no streaming inside execute().
    class _SilentRuntime:
        async def execute(self, ctx: AdapterExecutionContext) -> AdapterExecutionResult:
            role = ctx.agent.role
            if role == "strategist":
                return AdapterExecutionResult(
                    exit_code=0,
                    result_json={"text": json.dumps({"audience": "x", "hooks": ["a"]})},
                )
            if role == "creative_director":
                return AdapterExecutionResult(
                    exit_code=0,
                    result_json={"text": json.dumps({"format_mix": ["reel_9_16"], "budget_per_asset_usd": 1.0})},
                )
            if role == "copywriter":
                return AdapterExecutionResult(
                    exit_code=0,
                    result_json={"text": json.dumps({"items": [{"hook": "a", "headline": "h", "cta": "c"}]})},
                )
            if role == "art_director":
                return AdapterExecutionResult(
                    exit_code=0,
                    result_json={"text": json.dumps({"references": ["r"], "image_model": "fal-ai/flux/dev", "video_model": "fal-ai/sora-2", "params": {"aspect_ratio": "9:16", "style": "x"}})},
                )
            return AdapterExecutionResult(exit_code=0, result_json={"text": "{}"})

    graph = CampaignGraph(
        brief={"keyword": "x"}, brand={}, runtime=_SilentRuntime(), format="reel"
    )
    events = [evt async for evt in graph.run()]

    deltas = [e for e in events if e.get("type") == "text_delta"]
    dones = [e for e in events if e.get("type") == "text_done"]

    assert len(deltas) == 0, "no streaming was simulated, expected zero deltas"
    # Strategist + creative_director (sequential) + copywriter + art_director
    # (parallel) + analyst + publisher = 6 text_done events.
    assert len(dones) == 6, f"expected 6 text_done events, got {len(dones)}"
    assert all(d["fullText"] == "" for d in dones)
