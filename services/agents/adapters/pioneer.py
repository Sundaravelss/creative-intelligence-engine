"""Pioneer adapter — OpenAI-compatible HTTP client against PIONEER_BASE_URL.

Streams `/chat/completions` SSE chunks. Used as the default LLM backend per
the WS-D plan ("Pioneer fine-tuned model primary"). Falls through to the next
adapter in the runtime fallback chain when PIONEER_API_KEY is not configured.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

from ..contract import (
    AdapterExecutionContext,
    AdapterExecutionResult,
    UsageSummary,
)

logger = logging.getLogger(__name__)


class PioneerNotConfigured(RuntimeError):
    """Raised when PIONEER_API_KEY is missing so the runtime can fall through."""


def _build_messages(ctx: AdapterExecutionContext) -> list[dict[str, str]]:
    system = ctx.agent.instructions or ""
    user = str(ctx.context.get("prompt") or ctx.config.get("prompt") or "")
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    if user:
        messages.append({"role": "user", "content": user})
    return messages


async def _emit(ctx: AdapterExecutionContext, stream: str, message: str) -> None:
    if ctx.on_log is not None:
        await ctx.on_log(stream, message)  # type: ignore[arg-type]


async def execute(ctx: AdapterExecutionContext) -> AdapterExecutionResult:
    api_key = os.environ.get("PIONEER_API_KEY", "").strip()
    base_url = os.environ.get("PIONEER_BASE_URL", "").strip()
    model = (
        ctx.config.get("model")
        or os.environ.get("LLM_MARKETING_MODEL_ID", "").strip()
    )

    if not api_key:
        raise PioneerNotConfigured("PIONEER_API_KEY is not set")
    if not base_url:
        raise PioneerNotConfigured("PIONEER_BASE_URL is not set")
    if not model:
        raise PioneerNotConfigured("LLM_MARKETING_MODEL_ID is not set")

    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": model,
        "messages": _build_messages(ctx),
        "stream": True,
        "temperature": float(ctx.config.get("temperature", 0.7)),
    }
    if "max_tokens" in ctx.config:
        payload["max_tokens"] = int(ctx.config["max_tokens"])
    if "tools" in ctx.config:
        payload["tools"] = ctx.config["tools"]

    await _emit(ctx, "stdout", f"[pioneer] POST {url} model={model}\n")

    text_parts: list[str] = []
    usage = UsageSummary()

    timeout = httpx.Timeout(60.0, connect=10.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as resp:
                if resp.status_code >= 400:
                    body = await resp.aread()
                    raise RuntimeError(
                        f"pioneer http {resp.status_code}: {body.decode('utf-8', 'replace')[:400]}"
                    )
                async for raw_line in resp.aiter_lines():
                    line = raw_line.strip()
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[len("data:"):].strip()
                    if data == "[DONE]":
                        break
                    try:
                        evt = json.loads(data)
                    except json.JSONDecodeError:
                        logger.debug("pioneer: non-JSON SSE chunk: %s", data[:120])
                        continue
                    choices = evt.get("choices") or []
                    if choices:
                        delta = choices[0].get("delta") or {}
                        chunk = delta.get("content") or ""
                        if chunk:
                            text_parts.append(chunk)
                            await _emit(ctx, "stdout", chunk)
                    if "usage" in evt and isinstance(evt["usage"], dict):
                        u = evt["usage"]
                        usage = UsageSummary(
                            input_tokens=int(u.get("prompt_tokens") or 0),
                            output_tokens=int(u.get("completion_tokens") or 0),
                        )
    except httpx.HTTPError as exc:
        return AdapterExecutionResult(
            exit_code=1,
            error=f"pioneer transport error: {exc}",
            result_json={"text": "".join(text_parts)},
        )

    text = "".join(text_parts)
    return AdapterExecutionResult(
        exit_code=0,
        usage=usage,
        result_json={"text": text, "model": model, "provider": "pioneer"},
    )


__all__ = ["execute", "PioneerNotConfigured"]
