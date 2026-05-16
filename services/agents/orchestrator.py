"""CampaignGraph — plain async Python state machine driving the 6-node pipeline.

No LangGraph: just an ordered list of forward steps, with copywriter and
art_director running in parallel after the creative director picks the format
mix. Each transition emits SSE-friendly events.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any, AsyncIterator

from .nodes import (
    analyst,
    art_director,
    copywriter,
    creative_director,
    publisher,
    strategist,
)

logger = logging.getLogger(__name__)


class CampaignGraph:
    """Sequential 6-node pipeline with one parallel fan-out step."""

    def __init__(
        self,
        brief: dict[str, Any],
        brand: dict[str, Any] | None,
        runtime: Any,
        *,
        format: str = "reel",
        adapter_config: dict[str, Any] | None = None,
        run_id: str | None = None,
    ) -> None:
        self._brief = dict(brief or {})
        self._brand = dict(brand or {})
        self._runtime = runtime
        self._format = format
        self._adapter_config = dict(adapter_config or {})
        self._run_id = run_id or f"cg_{uuid.uuid4().hex[:12]}"

    async def run(self) -> AsyncIterator[dict[str, Any]]:
        start = time.monotonic()
        state: dict[str, Any] = {
            "run_id": self._run_id,
            "brief": self._brief,
            "brand": self._brand,
            "format": self._format,
            "adapter_config": self._adapter_config,
        }

        yield {
            "type": "run_start",
            "run_id": self._run_id,
            "brief": self._brief,
            "format": self._format,
        }

        # 1. Strategist
        async for evt in self._run_node("strategist", strategist.forward, state):
            if evt["type"] == "node_complete":
                state = evt["state"]
            yield self._public(evt)

        # 2. Creative Director
        async for evt in self._run_node(
            "creative_director", creative_director.forward, state
        ):
            if evt["type"] == "node_complete":
                state = evt["state"]
            yield self._public(evt)

        # 3 + 4. Copywriter and Art Director in parallel.
        yield {"type": "node_start", "node_id": "copywriter+art_director"}
        copy_task = asyncio.create_task(copywriter.forward(state, self._runtime))
        art_task = asyncio.create_task(art_director.forward(state, self._runtime))
        copy_state, art_state = await asyncio.gather(copy_task, art_task)
        # Merge — both produce disjoint keys.
        state = {**state, **copy_state, **art_state}
        yield {
            "type": "node_complete",
            "node_id": "copywriter+art_director",
            "output": {
                "headlines": state.get("headlines"),
                "ctas": state.get("ctas"),
                "image_model": state.get("image_model"),
                "video_model": state.get("video_model"),
            },
        }

        # 5. Analyst
        async for evt in self._run_node("analyst", analyst.forward, state):
            if evt["type"] == "node_complete":
                state = evt["state"]
            yield self._public(evt)

        # Emit one artifact event per format with score attached.
        score = state.get("score") or {}
        for fmt in state.get("format_mix") or []:
            yield {
                "type": "artifact",
                "artifact": {
                    "id": f"art_{uuid.uuid4().hex[:10]}",
                    "format": fmt,
                    "headline": (state.get("headlines") or [None])[0],
                    "image_model": state.get("image_model"),
                    "video_model": state.get("video_model"),
                    "score": score,
                },
            }

        # 6. Publisher
        async for evt in self._run_node("publisher", publisher.forward, state):
            if evt["type"] == "node_complete":
                state = evt["state"]
            yield self._public(evt)

        yield {
            "type": "done",
            "run_id": self._run_id,
            "elapsed_sec": round(time.monotonic() - start, 3),
            "posts": state.get("posts", []),
            "score": state.get("score", {}),
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _run_node(
        self, node_id: str, fn: Any, state: dict[str, Any]
    ) -> AsyncIterator[dict[str, Any]]:
        yield {"type": "node_start", "node_id": node_id}
        try:
            new_state = await fn(state, self._runtime)
        except Exception as exc:  # noqa: BLE001 — surface as event
            logger.exception("node %s failed", node_id)
            yield {"type": "error", "node_id": node_id, "error": str(exc)}
            return
        yield {
            "type": "node_complete",
            "node_id": node_id,
            "state": new_state,
            "output": {
                k: v
                for k, v in new_state.items()
                if k not in {"brief", "brand", "adapter_config", "run_id"}
                and not isinstance(v, dict)
            },
        }

    @staticmethod
    def _public(evt: dict[str, Any]) -> dict[str, Any]:
        # Strip the internal `state` key from emitted events.
        if evt.get("type") == "node_complete" and "state" in evt:
            return {k: v for k, v in evt.items() if k != "state"}
        return evt


__all__ = ["CampaignGraph"]
