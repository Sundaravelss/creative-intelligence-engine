"""Art Director node — picks references and image/video model parameters."""

from __future__ import annotations

import json
import os
from typing import Any

from ..contract import AdapterExecutionContext, AgentSpec, RuntimeState

INSTRUCTIONS = """You are an art director for paid social ads.
Given audience + hooks + format mix, output strict JSON:
{
  "references": ["<short visual reference description>", ...],
  "image_model": "<fal-ai model id>",
  "video_model": "<fal-ai model id>",
  "params": {
    "aspect_ratio": "9:16" | "1:1" | "16:9",
    "style": "<one-line style note>"
  }
}
Return ONLY the JSON.
"""

_AGENT = AgentSpec(
    id="art_director",
    name="Art Director",
    role="art_director",
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
    payload = {
        "audience": state.get("audience"),
        "hooks": state.get("hooks", []),
        "format_mix": state.get("format_mix", []),
        "brand": state.get("brand", {}),
    }
    ctx = AdapterExecutionContext(
        run_id=str(state.get("run_id", "run")),
        agent=_AGENT,
        runtime=RuntimeState(),
        config=state.get("adapter_config", {}),
        context={"prompt": json.dumps(payload, ensure_ascii=False)},
    )
    result = await runtime.execute(ctx)
    parsed = _parse((result.result_json or {}).get("text", ""))
    return {
        **state,
        "references": parsed.get("references")
        or [f"hero shot of {state.get('brief', {}).get('keyword', 'product')}"],
        "image_model": parsed.get("image_model")
        or os.environ.get("FAL_DEFAULT_IMAGE_MODEL", "fal-ai/flux/dev"),
        "video_model": parsed.get("video_model")
        or os.environ.get("FAL_DEFAULT_VIDEO_MODEL", "fal-ai/sora-2"),
        "art_params": parsed.get("params") or {"aspect_ratio": "9:16", "style": "clean editorial"},
    }


__all__ = ["INSTRUCTIONS", "forward"]
