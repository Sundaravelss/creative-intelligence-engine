"""Creative Director node — picks format mix and per-asset budget."""

from __future__ import annotations

import json
from typing import Any

from ..contract import AdapterExecutionContext, AgentSpec, RuntimeState

INSTRUCTIONS = """You are a creative director.
Given audience + hooks + the requested top-level format, output strict JSON:
{
  "format_mix": ["reel_9_16", "square_1_1", ...],
  "budget_per_asset_usd": <number>
}
Pick 2-4 formats. Return ONLY the JSON.
"""

_AGENT = AgentSpec(
    id="creative_director",
    name="Creative Director",
    role="creative_director",
    instructions=INSTRUCTIONS,
    adapter_type="pioneer",
)

_DEFAULT_MIX = ["reel_9_16", "square_1_1", "story_9_16"]


def _parse(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}


async def forward(state: dict[str, Any], runtime: Any) -> dict[str, Any]:
    payload = {
        "audience": state.get("audience"),
        "hooks": state.get("hooks", []),
        "format": state.get("format"),
    }
    ctx = AdapterExecutionContext(
        run_id=str(state.get("run_id", "run")),
        agent=_AGENT,
        runtime=RuntimeState(),
        config=state.get("adapter_config", {}),
        context={"prompt": json.dumps(payload, ensure_ascii=False)},
        on_log=state.get("on_log"),
    )
    result = await runtime.execute(ctx)
    parsed = _parse((result.result_json or {}).get("text", ""))
    mix = parsed.get("format_mix") or _DEFAULT_MIX
    budget = float(parsed.get("budget_per_asset_usd") or 0.50)
    return {
        **state,
        "format_mix": list(mix),
        "budget_per_asset_usd": budget,
    }


__all__ = ["INSTRUCTIONS", "forward"]
