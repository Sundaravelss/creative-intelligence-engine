"""Tests for the Higgsfield-style storyboard + marketing fan-out modes.

These exercise the Art Director's mode-aware variant expansion plus the
orchestrator's marketing-mode brief seeding. Adapter runtime is faked so
they run offline.
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
from agents.nodes.art_director import (  # noqa: E402
    STORYBOARD_SHOT_KINDS,
    forward as art_forward,
)
from agents.nodes.marketing_director import (  # noqa: E402
    MARKETING_FORMAT_MIX,
    MARKETING_HOOKS,
    forward as marketing_forward,
)
from agents.orchestrator import CampaignGraph  # noqa: E402


class _CannedRuntime:
    async def execute(self, ctx: AdapterExecutionContext) -> AdapterExecutionResult:
        role = ctx.agent.role
        if role == "strategist":
            text = json.dumps(
                {"audience": "creators", "hooks": ["a", "b", "c"]}
            )
        elif role == "creative_director":
            text = json.dumps({"format_mix": ["reel"], "budget_per_asset_usd": 1.0})
        elif role == "copywriter":
            text = json.dumps({"items": []})
        elif role == "art_director":
            text = json.dumps(
                {
                    "references": ["hero shot"],
                    "image_model": "fal-ai/nano-banana-2",
                    "video_model": "fal-ai/sora-2",
                    "params": {"aspect_ratio": "9:16"},
                }
            )
        else:
            text = "{}"
        return AdapterExecutionResult(exit_code=0, result_json={"text": text})


@pytest.mark.asyncio
async def test_art_director_storyboard_mode_emits_six_camera_kinds() -> None:
    runtime = _CannedRuntime()
    state: dict[str, Any] = {
        "brief": {"keyword": "espresso pour", "mode": "storyboard"},
        "adapter_config": {},
    }
    new_state = await art_forward(state, runtime)
    variants = new_state["variants"]
    kinds = {v["shot_kind"] for v in variants}
    assert kinds == set(STORYBOARD_SHOT_KINDS)
    # 6 shots × VARIANTS_PER_SHOT (default 3) = 18
    assert len(variants) == 6 * 3


@pytest.mark.asyncio
async def test_art_director_default_mode_uses_references() -> None:
    runtime = _CannedRuntime()
    state: dict[str, Any] = {
        "brief": {"keyword": "espresso pour"},  # no mode
        "adapter_config": {},
    }
    new_state = await art_forward(state, runtime)
    variants = new_state["variants"]
    # Default fan-out yields 1 reference × 3 styles
    assert len(variants) == 3
    assert all(v["shot_kind"] == "wide" for v in variants)


@pytest.mark.asyncio
async def test_marketing_director_seeds_hooks_and_format_mix() -> None:
    state = {"brief": {"keyword": "kettle", "mode": "marketing"}}
    new_state = await marketing_forward(state, None)
    assert new_state["brief"]["hooks"] == list(MARKETING_HOOKS)
    assert new_state["format_mix"] == list(MARKETING_FORMAT_MIX)


@pytest.mark.asyncio
async def test_marketing_director_preserves_existing_hooks() -> None:
    state = {
        "brief": {"keyword": "kettle", "mode": "marketing", "hooks": ["custom"]}
    }
    new_state = await marketing_forward(state, None)
    assert new_state["brief"]["hooks"] == ["custom"]


@pytest.mark.asyncio
async def test_orchestrator_storyboard_mode_emits_artifact_per_kind() -> None:
    runtime = _CannedRuntime()
    graph = CampaignGraph(
        brief={"keyword": "espresso pour", "mode": "storyboard"},
        brand={},
        runtime=runtime,
        format="story",
    )
    artifact_kinds: list[str] = []
    async for evt in graph.run():
        if evt["type"] == "artifact":
            kind = evt["artifact"].get("shotKind")
            assert kind in STORYBOARD_SHOT_KINDS
            artifact_kinds.append(kind)
    # All 6 camera angles must show up at least once.
    assert set(artifact_kinds) == set(STORYBOARD_SHOT_KINDS)
