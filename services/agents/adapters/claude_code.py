"""Claude Code CLI adapter.

Spawns ``$CLAUDE_CODE_CLI_PATH --print -p <prompt> --output-format stream-json``
via ``asyncio.subprocess`` and parses JSONL stdout line-by-line. Mirrors the
shape of Paperclip's cursor-local adapter — the Claude Code and Cursor CLIs
share the same JSONL streaming contract.

Resumes provider-side sessions with ``--resume <session-id>`` when
``ctx.runtime.session_id`` is set.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

from ..contract import (
    AdapterExecutionContext,
    AdapterExecutionResult,
    UsageSummary,
)

logger = logging.getLogger(__name__)


class ClaudeCodeNotConfigured(RuntimeError):
    """Raised when the Claude Code CLI is not on PATH."""


async def _emit(ctx: AdapterExecutionContext, stream: str, message: str) -> None:
    if ctx.on_log is not None:
        await ctx.on_log(stream, message)  # type: ignore[arg-type]


def _build_prompt(ctx: AdapterExecutionContext) -> str:
    system = ctx.agent.instructions or ""
    user = str(ctx.context.get("prompt") or ctx.config.get("prompt") or "")
    if system and user:
        return f"{system}\n\n{user}"
    return user or system


def _build_args(prompt: str, ctx: AdapterExecutionContext) -> list[str]:
    args = ["--print", "-p", prompt, "--output-format", "stream-json"]
    session_id = ctx.runtime.session_id
    if session_id:
        args.extend(["--resume", session_id])
    model = ctx.config.get("model")
    if model:
        args.extend(["--model", str(model)])
    extra = ctx.config.get("extra_args") or []
    if isinstance(extra, list):
        args.extend(str(a) for a in extra)
    return args


async def execute(ctx: AdapterExecutionContext) -> AdapterExecutionResult:
    cli = os.environ.get("CLAUDE_CODE_CLI_PATH", "claude").strip() or "claude"
    prompt = _build_prompt(ctx)
    args = _build_args(prompt, ctx)

    await _emit(ctx, "stdout", f"[claude_code] spawn {cli} (args={len(args)})\n")

    try:
        proc = await asyncio.create_subprocess_exec(
            cli,
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        raise ClaudeCodeNotConfigured(
            f"Claude Code CLI not found at '{cli}'. Set CLAUDE_CODE_CLI_PATH."
        ) from exc

    text_parts: list[str] = []
    final_text: str | None = None
    usage = UsageSummary()
    cost_usd = 0.0
    new_session_id: str | None = ctx.runtime.session_id
    parse_errors = 0

    assert proc.stdout is not None  # for type-checker
    async for raw in proc.stdout:
        line = raw.decode("utf-8", errors="replace").strip()
        if not line:
            continue
        try:
            evt = json.loads(line)
        except json.JSONDecodeError:
            parse_errors += 1
            continue
        evt_type = evt.get("type")
        if evt_type == "assistant":
            content = evt.get("message", {}).get("content") or evt.get("content")
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        chunk = str(block.get("text", ""))
                        if chunk:
                            text_parts.append(chunk)
                            await _emit(ctx, "stdout", chunk)
            elif isinstance(content, str) and content:
                text_parts.append(content)
                await _emit(ctx, "stdout", content)
        elif evt_type == "result":
            final_text = (
                evt.get("result")
                or evt.get("text")
                or (evt.get("content") if isinstance(evt.get("content"), str) else None)
            )
            evt_usage = evt.get("usage") or {}
            if isinstance(evt_usage, dict):
                usage = UsageSummary(
                    input_tokens=int(evt_usage.get("input_tokens") or 0),
                    output_tokens=int(evt_usage.get("output_tokens") or 0),
                    cached_input_tokens=evt_usage.get("cache_read_input_tokens"),
                )
            cost_usd = float(evt.get("total_cost_usd") or evt.get("cost_usd") or 0.0)
            session_field = evt.get("session_id") or evt.get("sessionId")
            if isinstance(session_field, str) and session_field:
                new_session_id = session_field
        elif evt_type in {"tool_use", "tool_result", "system"}:
            # Forwarded for observability; not required for orchestrator output.
            await _emit(ctx, "stdout", f"[claude_code] event {evt_type}\n")

    stderr_bytes = await proc.stderr.read() if proc.stderr else b""
    rc = await proc.wait()

    if rc != 0:
        return AdapterExecutionResult(
            exit_code=rc,
            error=stderr_bytes.decode("utf-8", "replace")[:1000].strip()
            or f"claude_code exited with code {rc}",
            usage=usage,
            cost_usd=cost_usd,
            result_json={
                "text": final_text or "".join(text_parts),
                "session_id": new_session_id,
            },
        )

    if parse_errors:
        logger.warning("claude_code: %d JSONL lines failed to parse", parse_errors)

    session_params = (
        {"session_id": new_session_id} if new_session_id else None
    )
    return AdapterExecutionResult(
        exit_code=0,
        usage=usage,
        cost_usd=cost_usd,
        session_params=session_params,
        result_json={
            "text": final_text if final_text is not None else "".join(text_parts),
            "provider": "claude_code",
            "session_id": new_session_id,
            "model": ctx.config.get("model"),
        },
    )


__all__ = ["execute", "ClaudeCodeNotConfigured"]
