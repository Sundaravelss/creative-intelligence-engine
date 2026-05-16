"""Publisher node — calls the mock /api/publish/{channel} endpoint.

Until WS-G is up, returns a synthetic post id so the orchestrator can complete
end-to-end without external dependencies.
"""

from __future__ import annotations

import os
import uuid
from typing import Any

import httpx

from ..contract import AgentSpec

INSTRUCTIONS = """You are a publisher.
You translate the chosen format mix into channel-specific publish payloads
and dispatch them through /api/publish/{channel}. This is a mocked surface.
"""

_AGENT = AgentSpec(
    id="publisher",
    name="Publisher",
    role="publisher",
    instructions=INSTRUCTIONS,
    adapter_type="pioneer",
)


def _format_to_channel(fmt: str) -> str:
    f = (fmt or "").lower()
    if "reel" in f or "9_16" in f:
        return "instagram"
    if "story" in f:
        return "instagram"
    if "square" in f or "1_1" in f:
        return "meta"
    if "banner" in f or "16_9" in f:
        return "youtube"
    if "carousel" in f:
        return "linkedin"
    return "meta"


async def forward(state: dict[str, Any], _runtime: Any) -> dict[str, Any]:
    api_base = os.environ.get("API_BASE_URL", "").strip()
    formats: list[str] = state.get("format_mix") or []
    posts: list[dict[str, Any]] = []

    if api_base:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=2.0)) as client:
            for fmt in formats:
                channel = _format_to_channel(fmt)
                try:
                    resp = await client.post(
                        f"{api_base.rstrip('/')}/api/publish/{channel}",
                        json={
                            "format": fmt,
                            "headlines": state.get("headlines", []),
                            "hooks": state.get("hooks", []),
                        },
                    )
                    if resp.status_code < 400:
                        posts.append({"channel": channel, "format": fmt, **resp.json()})
                        continue
                except httpx.HTTPError:
                    pass
                posts.append(
                    {
                        "channel": channel,
                        "format": fmt,
                        "post_id": f"mock_{uuid.uuid4().hex[:8]}",
                        "mocked": True,
                    }
                )
    else:
        for fmt in formats:
            posts.append(
                {
                    "channel": _format_to_channel(fmt),
                    "format": fmt,
                    "post_id": f"mock_{uuid.uuid4().hex[:8]}",
                    "mocked": True,
                }
            )

    return {**state, "posts": posts}


__all__ = ["INSTRUCTIONS", "forward"]
