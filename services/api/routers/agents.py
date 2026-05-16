"""Agents orchestrator router. Streams CampaignGraph events as SSE."""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any, AsyncIterator

from fastapi import APIRouter
from pydantic import BaseModel, Field

from sse import event_stream  # type: ignore[import-not-found]

# Allow `from agents.*` imports when uvicorn is launched from services/api/.
_SERVICES_DIR = Path(__file__).resolve().parent.parent.parent
if str(_SERVICES_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVICES_DIR))

from agents import runtime as agent_runtime  # noqa: E402
from agents.orchestrator import CampaignGraph  # noqa: E402

# Importing the registry triggers adapter registration as a side effect.
from agents import registry as _registry  # noqa: E402, F401

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agents", tags=["agents"])


class CampaignRequest(BaseModel):
    brief: dict[str, Any] = Field(default_factory=dict)
    brand_id: str | None = None
    brand: dict[str, Any] | None = None
    format: str = "reel"
    adapter: str | None = None
    # Comma-separated adapter names, e.g. "claude_code,hermes_cli,openai".
    # Overrides ADAPTER_FALLBACK_CHAIN env var for this single request.
    fallback: str | None = None


@router.get("")
async def agents_index() -> dict[str, Any]:
    return {"adapters": _registry.names()}


def _runtime_proxy() -> Any:
    """Return an object with an `execute(ctx)` coroutine method.

    Wrapping the module function in an object lets tests inject fakes via the
    same interface CampaignGraph expects.
    """

    class _RuntimeProxy:
        async def execute(self, ctx: Any) -> Any:
            return await agent_runtime.execute(ctx)

    return _RuntimeProxy()


@router.post("/campaign")
async def campaign(req: CampaignRequest) -> Any:
    adapter_config: dict[str, Any] = {}
    if req.adapter:
        adapter_config["adapter"] = req.adapter
    if req.fallback:
        adapter_config["fallback_chain"] = req.fallback

    graph = CampaignGraph(
        brief=req.brief,
        brand=req.brand or {},
        runtime=_runtime_proxy(),
        format=req.format,
        adapter_config=adapter_config,
    )

    async def _events() -> AsyncIterator[dict[str, str]]:
        try:
            async for evt in graph.run():
                yield {
                    "event": str(evt.get("type", "message")),
                    "data": json.dumps(evt, default=str),
                }
        except Exception as exc:  # noqa: BLE001
            logger.exception("campaign run failed")
            yield {"event": "error", "data": json.dumps({"error": str(exc)})}

    return event_stream(_events())


__all__ = ["router"]
