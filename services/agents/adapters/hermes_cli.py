"""Hermes-CLI adapter — spawns nousresearch/hermes-agent as a subprocess.

Hermes is itself a model-agnostic agent runtime. We configure it (via
``hermes model …``) to delegate to the same local ``claude`` CLI we already
use for the ``claude_code`` adapter — same Anthropic auth, no extra
credentials.

The value-add over ``claude_code``: Hermes' wrapper adds skills, persistent
memory, MCP integration, and session search. Pure Claude reasoning
underneath; richer agent runtime around it.

Status (2026-05-16): the Hermes CLI is not yet installed on this dev
machine. This adapter raises ``HermesCliNotConfigured`` when the binary is
missing so the runtime fallback chain advances cleanly to the next adapter.
Install and use::

    curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
    hermes setup
    hermes model claude-cli   # or anthropic:claude-sonnet-4-6

Env vars
--------
``HERMES_CLI_PATH``       Path to the ``hermes`` binary. Default ``hermes`` (PATH).
``HERMES_CLI_MODEL``      Optional ``--model`` override per call (otherwise uses
                          whatever ``hermes config`` has set).
``HERMES_CLI_TIMEOUT_SEC`` Subprocess timeout in seconds (default 120).

Unknowns to verify post-install (see plan file Workstream E.3 §"Unknowns to
resolve"):
  1. exact non-interactive flag (``--print`` / ``--once`` / ``run --message``)
  2. stream-json event shape (key names: ``delta`` / ``text`` / ``content``)
  3. ``--resume <id>`` for parity with claude_code
  4. cleanest provider for delegating to local ``claude`` CLI

The implementation below is the safest first cut: invoke ``hermes`` with
``--print -p <prompt> --output-format stream-json`` (matching claude_code's
contract), then parse JSONL events line-by-line, accumulating any
``delta``/``text``/``content`` chunks. If the CLI's actual flags differ, the
subprocess will raise non-zero and the runtime falls through harmlessly.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
from typing import Any

from ..contract import (
    AdapterExecutionContext,
    AdapterExecutionResult,
    UsageSummary,
)

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT_SEC = 120.0


class HermesCliNotConfigured(RuntimeError):
    """Raised when the Hermes CLI is not installed so runtime can fall through."""


def _resolve_binary() -> str | None:
    """Return path to the hermes binary, or None if it's not on PATH."""
    candidate = os.environ.get("HERMES_CLI_PATH", "hermes").strip() or "hermes"
    # If candidate is an absolute path, accept it iff the file is executable.
    if os.path.isabs(candidate):
        return candidate if os.access(candidate, os.X_OK) else None
    # Otherwise resolve via PATH.
    return shutil.which(candidate)


async def _emit(ctx: AdapterExecutionContext, stream: str, message: str) -> None:
    if ctx.on_log is not None:
        await ctx.on_log(stream, message)  # type: ignore[arg-type]


def _build_prompt(ctx: AdapterExecutionContext) -> str:
    """Same contract as the other adapters: system instructions + user prompt."""
    system = (ctx.agent.instructions or "").strip()
    user = str(ctx.context.get("prompt") or ctx.config.get("prompt") or "").strip()
    if system and user:
        return f"{system}\n\n{user}"
    return user or system


def _extract_chunk(evt: dict[str, Any]) -> str:
    """Best-effort extraction of a text chunk from a Hermes stream-json event.

    Handles every key shape we've seen in similar CLIs (claude_code uses
    ``delta``, OpenAI-compatible streamers use ``choices[0].delta.content``,
    some emit a flat ``text``). Returns empty string for events that don't
    carry text (status, tool_use, etc.) — those are silently ignored.
    """
    if not isinstance(evt, dict):
        return ""
    direct = evt.get("delta") or evt.get("text") or evt.get("content")
    if isinstance(direct, str):
        return direct
    if isinstance(direct, dict):
        nested = direct.get("text") or direct.get("content")
        if isinstance(nested, str):
            return nested
    choices = evt.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            inner = first.get("delta") or first.get("message") or {}
            if isinstance(inner, dict):
                chunk = inner.get("content")
                if isinstance(chunk, str):
                    return chunk
    return ""


async def execute(ctx: AdapterExecutionContext) -> AdapterExecutionResult:
    """Run the Hermes CLI with the supplied prompt and return its text output."""
    binary = _resolve_binary()
    if not binary:
        raise HermesCliNotConfigured(
            "Hermes CLI not found on PATH. Set HERMES_CLI_PATH or install: "
            "curl -fsSL https://raw.githubusercontent.com/NousResearch/"
            "hermes-agent/main/scripts/install.sh | bash"
        )

    prompt = _build_prompt(ctx)
    if not prompt:
        return AdapterExecutionResult(
            exit_code=1,
            error="hermes_cli: no prompt provided in ctx.context or ctx.config",
            result_json={"text": ""},
        )

    cmd: list[str] = [binary, "--print", "-p", prompt, "--output-format", "stream-json"]

    model_override = os.environ.get("HERMES_CLI_MODEL", "").strip()
    if model_override:
        cmd += ["--model", model_override]

    # `--resume` parity with claude_code: lets the orchestrator keep one
    # Hermes session across multiple node calls in a single campaign run.
    session_id = getattr(getattr(ctx, "runtime", None), "session_id", None)
    if isinstance(session_id, str) and session_id:
        cmd += ["--resume", session_id]

    timeout_sec = float(os.environ.get("HERMES_CLI_TIMEOUT_SEC", _DEFAULT_TIMEOUT_SEC))

    await _emit(ctx, "stdout", f"[hermes_cli] exec {binary} (timeout={timeout_sec}s)\n")

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={**os.environ},
        )
    except (OSError, FileNotFoundError) as exc:
        raise HermesCliNotConfigured(f"Failed to spawn {binary}: {exc}") from exc

    text_parts: list[str] = []
    # Box `usage` in a single-element list so the inner async closure can
    # reassign it without needing `nonlocal`.
    usage_box: list[UsageSummary] = [UsageSummary()]
    stderr_buf = bytearray()

    async def _drain_stderr() -> None:
        if proc.stderr is None:
            return
        async for chunk in proc.stderr:
            stderr_buf.extend(chunk)

    async def _drain_stdout() -> None:
        if proc.stdout is None:
            return
        async for raw in proc.stdout:
            line = raw.decode("utf-8", errors="replace").rstrip("\n").rstrip("\r")
            if not line:
                continue
            try:
                evt = json.loads(line)
            except json.JSONDecodeError:
                # Not all lines are JSON — Hermes may emit plain text fall-through.
                # Treat unrecognized lines as raw text so we don't lose output.
                text_parts.append(line)
                await _emit(ctx, "stdout", line)
                continue
            chunk = _extract_chunk(evt) if isinstance(evt, dict) else ""
            if chunk:
                text_parts.append(chunk)
                await _emit(ctx, "stdout", chunk)
            if isinstance(evt, dict) and isinstance(evt.get("usage"), dict):
                u = evt["usage"]
                usage_box[0] = UsageSummary(
                    input_tokens=int(u.get("input_tokens") or u.get("prompt_tokens") or 0),
                    output_tokens=int(u.get("output_tokens") or u.get("completion_tokens") or 0),
                )

    try:
        await asyncio.wait_for(
            asyncio.gather(_drain_stdout(), _drain_stderr()),
            timeout=timeout_sec,
        )
        rc = await proc.wait()
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        return AdapterExecutionResult(
            exit_code=124,
            error=f"hermes_cli timed out after {timeout_sec}s",
            result_json={"text": "".join(text_parts)},
        )

    if rc != 0:
        err = stderr_buf.decode("utf-8", errors="replace")[:400]
        return AdapterExecutionResult(
            exit_code=rc,
            error=f"hermes_cli rc={rc}: {err}",
            result_json={"text": "".join(text_parts)},
        )

    return AdapterExecutionResult(
        exit_code=0,
        usage=usage_box[0],
        result_json={
            "text": "".join(text_parts),
            "model": model_override or "hermes-cli-default",
            "provider": "hermes_cli",
        },
    )


__all__ = ["execute", "HermesCliNotConfigured"]
