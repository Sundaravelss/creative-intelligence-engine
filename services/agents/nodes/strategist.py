"""Strategist node — derives audience + hooks from brief + research."""

from __future__ import annotations

import json
from typing import Any

from ..contract import AdapterExecutionContext, AgentSpec, RuntimeState

INSTRUCTIONS = """You are a senior marketing strategist.
Given a creative brief and (optionally) research notes, output a strict JSON
object with shape:
{
  "audience": "<one sentence describing the target persona>",
  "hooks": ["<hook 1>", "<hook 2>", "<hook 3>"]
}
Return ONLY the JSON. Keep hooks under 12 words each.
"""

_AGENT = AgentSpec(
    id="strategist",
    name="Strategist",
    role="strategist",
    instructions=INSTRUCTIONS,
    adapter_type="pioneer",
)


def _parse_json(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    if not text:
        return {}
    # Tolerate fenced output.
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
    brief = state.get("brief") or {}
    research = state.get("research") or {}
    prompt = (
        "BRIEF:\n"
        + json.dumps(brief, ensure_ascii=False)
        + "\n\nRESEARCH:\n"
        + json.dumps(research, ensure_ascii=False)
    )
    ctx = AdapterExecutionContext(
        run_id=str(state.get("run_id", "run")),
        agent=_AGENT,
        runtime=RuntimeState(),
        config=state.get("adapter_config", {}),
        context={"prompt": prompt},
        on_log=state.get("on_log"),
    )
    result = await runtime.execute(ctx)
    text = (result.result_json or {}).get("text", "") if result else ""
    parsed = _parse_json(text)

    audience = parsed.get("audience") or f"buyers interested in {brief.get('keyword', 'this product')}"
    hooks = parsed.get("hooks") or [
        f"Discover {brief.get('keyword', 'something new')}",
        "Limited drop — be the first",
        "The look everyone is talking about",
    ]
    return {
        **state,
        "audience": audience,
        "hooks": list(hooks)[:5],
    }


__all__ = ["INSTRUCTIONS", "forward"]
