"""OpenAI adapter — uses the official `openai` Python SDK.

Streams chat completions and parses tool calls when ``ctx.config["tools"]`` is
set. Selects the hero model when ``ctx.config["hero"]`` is truthy, otherwise
the default model from the ``OPENAI_MODEL_DEFAULT`` env var.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from ..contract import (
    AdapterExecutionContext,
    AdapterExecutionResult,
    UsageSummary,
)

logger = logging.getLogger(__name__)


class OpenAINotConfigured(RuntimeError):
    """Raised when OPENAI_API_KEY is missing so the runtime can fall through."""


async def _emit(ctx: AdapterExecutionContext, stream: str, message: str) -> None:
    if ctx.on_log is not None:
        await ctx.on_log(stream, message)  # type: ignore[arg-type]


def _build_messages(ctx: AdapterExecutionContext) -> list[dict[str, str]]:
    system = ctx.agent.instructions or ""
    user = str(ctx.context.get("prompt") or ctx.config.get("prompt") or "")
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    if user:
        messages.append({"role": "user", "content": user})
    return messages


def _resolve_model(ctx: AdapterExecutionContext) -> str:
    if ctx.config.get("model"):
        return str(ctx.config["model"])
    if ctx.config.get("hero", False):
        return os.environ.get("OPENAI_MODEL_HERO", "gpt-4o").strip() or "gpt-4o"
    return os.environ.get("OPENAI_MODEL_DEFAULT", "gpt-4o-mini").strip() or "gpt-4o-mini"


async def execute(ctx: AdapterExecutionContext) -> AdapterExecutionResult:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise OpenAINotConfigured("OPENAI_API_KEY is not set")

    # Imported lazily so this module is importable without the SDK installed.
    try:
        from openai import AsyncOpenAI  # type: ignore[import-not-found]
    except ImportError as exc:  # pragma: no cover - env setup error
        raise OpenAINotConfigured(f"openai SDK unavailable: {exc}") from exc

    model = _resolve_model(ctx)
    client = AsyncOpenAI(api_key=api_key)

    kwargs: dict[str, Any] = {
        "model": model,
        "messages": _build_messages(ctx),
        "stream": True,
        "temperature": float(ctx.config.get("temperature", 0.7)),
    }
    if "max_tokens" in ctx.config:
        kwargs["max_tokens"] = int(ctx.config["max_tokens"])
    if "tools" in ctx.config:
        kwargs["tools"] = ctx.config["tools"]
    # Some SDK versions require this opt-in to surface usage in streaming.
    kwargs["stream_options"] = {"include_usage": True}

    await _emit(ctx, "stdout", f"[openai] chat.completions model={model}\n")

    text_parts: list[str] = []
    tool_calls: list[dict[str, Any]] = []
    usage = UsageSummary()

    try:
        stream = await client.chat.completions.create(**kwargs)
        async for evt in stream:
            choices = getattr(evt, "choices", None) or []
            if choices:
                delta = choices[0].delta
                chunk = getattr(delta, "content", None) or ""
                if chunk:
                    text_parts.append(chunk)
                    await _emit(ctx, "stdout", chunk)
                tcs = getattr(delta, "tool_calls", None) or []
                for tc in tcs:
                    tool_calls.append(
                        {
                            "id": getattr(tc, "id", None),
                            "type": getattr(tc, "type", "function"),
                            "function": {
                                "name": getattr(getattr(tc, "function", None), "name", None),
                                "arguments": getattr(
                                    getattr(tc, "function", None), "arguments", ""
                                )
                                or "",
                            },
                        }
                    )
            evt_usage = getattr(evt, "usage", None)
            if evt_usage is not None:
                usage = UsageSummary(
                    input_tokens=int(getattr(evt_usage, "prompt_tokens", 0) or 0),
                    output_tokens=int(getattr(evt_usage, "completion_tokens", 0) or 0),
                )
    except Exception as exc:  # noqa: BLE001 — surface as result.error
        return AdapterExecutionResult(
            exit_code=1,
            error=f"openai error: {exc}",
            result_json={"text": "".join(text_parts)},
        )

    return AdapterExecutionResult(
        exit_code=0,
        usage=usage,
        result_json={
            "text": "".join(text_parts),
            "model": model,
            "provider": "openai",
            "tool_calls": tool_calls,
        },
    )


__all__ = ["execute", "OpenAINotConfigured"]
