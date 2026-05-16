"""Copywriter node — produces headlines + CTAs per hook."""

from __future__ import annotations

import json
from typing import Any

from ..contract import AdapterExecutionContext, AgentSpec, RuntimeState

INSTRUCTIONS = """You are a senior performance copywriter.
For each hook supplied, produce a punchy headline (<10 words) and a CTA
(<5 words). Output strict JSON:
{
  "items": [
    {"hook": "<original>", "headline": "<...>", "cta": "<...>"}
  ]
}
Return ONLY the JSON.
"""

_AGENT = AgentSpec(
    id="copywriter",
    name="Copywriter",
    role="copywriter",
    instructions=INSTRUCTIONS,
    adapter_type="pioneer",
)


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
    hooks = state.get("hooks") or []
    payload = {"audience": state.get("audience"), "hooks": hooks}
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
    items = parsed.get("items")
    if not items:
        items = [{"hook": h, "headline": h, "cta": "Shop now"} for h in hooks]
    return {
        **state,
        "headlines": [it.get("headline") for it in items if isinstance(it, dict)],
        "ctas": [it.get("cta") for it in items if isinstance(it, dict)],
        "copy_items": items,
    }


__all__ = ["INSTRUCTIONS", "forward"]
