"""SSE helper used by routers that stream events (WS-C generate, WS-D agents).

Wraps sse-starlette so router code can do:

    @router.post("/api/generate")
    async def generate(req: GenerateRequest):
        return event_stream(_generator(req))
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

from sse_starlette.sse import EventSourceResponse


async def _format_events(source: AsyncIterator[Any]) -> AsyncIterator[dict[str, str]]:
    async for event in source:
        if isinstance(event, dict) and "data" in event:
            yield event
        else:
            yield {"data": json.dumps(event, default=str)}


def event_stream(source: AsyncIterator[Any]) -> EventSourceResponse:
    """Wrap an async generator of dicts as an SSE response."""
    return EventSourceResponse(_format_events(source))
