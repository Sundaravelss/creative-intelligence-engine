"""CampaignGraph — plain async Python state machine driving the 6-node pipeline.

No LangGraph: just an ordered list of forward steps, with copywriter and
art_director running in parallel after the creative director picks the format
mix. Each transition emits SSE-friendly events.

Events emitted (current contract — additive, never break old consumers):
  - run_start              (legacy; kept for back-compat with v1/v2 chat)
  - node_start             (legacy)
  - node_complete          (legacy)
  - artifact               (legacy)
  - done                   (legacy)
  - error                  (legacy)
  - started                (v3 W0; once at the top of run())
  - thought                (v3 W0; after strategist + creative_director)
  - agent_step_start       (v3 W0; before each non-reasoning node)
  - agent_step_complete    (v3 W0; after each non-reasoning node)

The new events let the v3 Studio chat render ✻ ShopOS started / ✻ Thought / and
per-agent step blocks. Event keys mirror the keys in
`apps/web/lib/agentAvatars.ts::AGENT_AVATARS` so the frontend can resolve an
avatar via `avatarFor(payload.agentId)` without any glue.
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

# Maps orchestrator node ids → AGENT_AVATARS keys in agentAvatars.ts.
# `analyst` is the orchestrator label; the frontend label is `performance_analyst`.
_NODE_TO_AGENT_ID: dict[str, str] = {
    "strategist": "strategist",
    "creative_director": "creative_director",
    "copywriter": "copywriter",
    "art_director": "art_director",
    "analyst": "performance_analyst",
    "publisher": "publisher",
}

# Human-friendly labels for agent_step_start / agent_step_complete blocks.
_NODE_LABELS: dict[str, str] = {
    "copywriter": "Write copy",
    "art_director": "Build creative brief",
    "copywriter+art_director": "Build creative brief",
    "analyst": "Score variants",
    "publisher": "Publish",
}

# Reasoning nodes — these emit `thought` rather than `agent_step_*`.
_REASONING_NODES: frozenset[str] = frozenset({"strategist", "creative_director"})


def _summarize_thought(node_id: str, output: dict[str, Any]) -> tuple[str, str]:
    """Best-effort (summary, fullText) for a reasoning node's thought event.

    `summary` is the short pill label (e.g. "Identified 3 hooks for Gen-Z"),
    `fullText` is the expanded panel content. Both are derived from the node
    output without an extra LLM call.
    """
    if node_id == "strategist":
        hooks = output.get("hooks") or []
        audience = output.get("audience") or ""
        summary = (
            f"Identified {len(hooks)} hook{'s' if len(hooks) != 1 else ''}"
            + (f" for {audience}" if audience else "")
        )
        full_lines = [f"Audience: {audience}"] if audience else []
        if hooks:
            full_lines.append("Hooks:")
            full_lines.extend(f"  • {h}" for h in hooks)
        return summary or "Strategist done", "\n".join(full_lines) or summary
    if node_id == "creative_director":
        mix = output.get("format_mix") or []
        budget = output.get("budget_per_asset_usd")
        summary = f"Picked {len(mix)} format{'s' if len(mix) != 1 else ''}"
        if budget is not None:
            summary += f" · ${budget}/asset"
        full_lines = [f"Format mix: {', '.join(mix)}"] if mix else []
        if budget is not None:
            full_lines.append(f"Budget per asset: ${budget}")
        return summary or "Creative Director done", "\n".join(full_lines) or summary
    return f"{node_id} done", ""


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
        # v3 W0: ✻ ShopOS started pill in the chat thread.
        yield {"type": "started"}

        # 1. Strategist (reasoning → emits `thought`)
        node_started = time.monotonic()
        async for evt in self._run_node("strategist", strategist.forward, state):
            if evt["type"] == "node_complete":
                state = evt["state"]
            yield self._public(evt)
        if "audience" in state or "hooks" in state:
            summary, full_text = _summarize_thought(
                "strategist",
                {"audience": state.get("audience"), "hooks": state.get("hooks")},
            )
            yield {
                "type": "thought",
                "agentId": "strategist",
                "summary": summary,
                "fullText": full_text,
                "elapsedSec": round(time.monotonic() - node_started, 2),
            }

        # 2. Creative Director (reasoning → emits `thought`)
        node_started = time.monotonic()
        async for evt in self._run_node(
            "creative_director", creative_director.forward, state
        ):
            if evt["type"] == "node_complete":
                state = evt["state"]
            yield self._public(evt)
        if "format_mix" in state or "budget_per_asset_usd" in state:
            summary, full_text = _summarize_thought(
                "creative_director",
                {
                    "format_mix": state.get("format_mix"),
                    "budget_per_asset_usd": state.get("budget_per_asset_usd"),
                },
            )
            yield {
                "type": "thought",
                "agentId": "creative_director",
                "summary": summary,
                "fullText": full_text,
                "elapsedSec": round(time.monotonic() - node_started, 2),
            }

        # 3 + 4. Copywriter and Art Director in parallel.
        # v3 W0: emit one agent_step_* pair per agent so the chat can render
        # two side-by-side step blocks while they run concurrently.
        yield {"type": "node_start", "node_id": "copywriter+art_director"}
        yield {
            "type": "agent_step_start",
            "agentId": "copywriter",
            "label": _NODE_LABELS["copywriter"],
            "totalSubsteps": 2,
        }
        yield {
            "type": "agent_step_start",
            "agentId": "art_director",
            "label": _NODE_LABELS["art_director"],
            "totalSubsteps": 2,
        }
        copy_task = asyncio.create_task(copywriter.forward(state, self._runtime))
        art_task = asyncio.create_task(art_director.forward(state, self._runtime))
        copy_state, art_state = await asyncio.gather(
            copy_task, art_task, return_exceptions=False
        )
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
        yield {
            "type": "agent_step_complete",
            "agentId": "copywriter",
            "completedSubsteps": 2,
            "substeps": [
                {"label": "joined", "status": "joined"},
                {"label": _NODE_LABELS["copywriter"], "status": "done"},
            ],
        }
        yield {
            "type": "agent_step_complete",
            "agentId": "art_director",
            "completedSubsteps": 2,
            "substeps": [
                {"label": "joined", "status": "joined"},
                {"label": _NODE_LABELS["art_director"], "status": "done"},
            ],
        }

        # 5. Analyst (non-reasoning → emits agent_step_*)
        async for evt in self._run_node_with_step("analyst", analyst.forward, state):
            if evt["type"] == "node_complete":
                state = evt["state"]
            yield self._public(evt)

        # Emit one artifact event per variant with shot grouping. The chat
        # rail uses shotId to bucket variants under a single generation
        # block; the canvas uses it to render a VariantStack per shot.
        score = state.get("score") or {}
        format_mix = state.get("format_mix") or [self._format]
        primary_format = format_mix[0]
        variants = state.get("variants") or []
        if not variants:
            variants = [
                {
                    "shot_id": "shot_1",
                    "variant_id": "shot_1-v0",
                    "variant_label": "default",
                    "prompt": (state.get("references") or [""])[0],
                }
            ]
        for variant in variants:
            artifact_id = f"art_{uuid.uuid4().hex[:10]}"
            yield {
                "type": "artifact",
                "artifact": {
                    "id": artifact_id,
                    "kind": "image",
                    "name": f"{variant['variant_label'].title()} — {variant['shot_id']}",
                    "url": "",  # generation adapter populates this in real runs
                    "shotId": variant["shot_id"],
                    "variantId": variant["variant_id"],
                    "variantLabel": variant["variant_label"],
                    "format": primary_format,
                    "headline": (state.get("headlines") or [None])[0],
                    "image_model": state.get("image_model"),
                    "video_model": state.get("video_model"),
                    "score": score,
                    "meta": {
                        "variantOf": variant["shot_id"],
                        "variantLabel": variant["variant_label"],
                        "prompt": variant["prompt"],
                    },
                },
            }

        # 6. Publisher (non-reasoning → emits agent_step_*)
        async for evt in self._run_node_with_step("publisher", publisher.forward, state):
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

    async def _run_node_with_step(
        self, node_id: str, fn: Any, state: dict[str, Any]
    ) -> AsyncIterator[dict[str, Any]]:
        """`_run_node` + v3 agent_step_start/complete events around it.

        Used for non-reasoning nodes (analyst, publisher). Emits the same
        legacy node_start/node_complete pair PLUS the new agent_step_* pair so
        old and new chat consumers both render. On failure, emits
        agent_step_complete with status=failed and the legacy error event.
        """
        agent_id = _NODE_TO_AGENT_ID.get(node_id, node_id)
        label = _NODE_LABELS.get(node_id, node_id.replace("_", " ").title())
        yield {
            "type": "agent_step_start",
            "agentId": agent_id,
            "label": label,
            "totalSubsteps": 1,
        }

        node_failed = False
        async for evt in self._run_node(node_id, fn, state):
            if evt["type"] == "error":
                node_failed = True
            yield evt

        yield {
            "type": "agent_step_complete",
            "agentId": agent_id,
            "completedSubsteps": 0 if node_failed else 1,
            "substeps": [
                {"label": label, "status": "failed" if node_failed else "done"},
            ],
        }

    @staticmethod
    def _public(evt: dict[str, Any]) -> dict[str, Any]:
        # Strip the internal `state` key from emitted events.
        if evt.get("type") == "node_complete" and "state" in evt:
            return {k: v for k, v in evt.items() if k != "state"}
        return evt


__all__ = ["CampaignGraph"]
