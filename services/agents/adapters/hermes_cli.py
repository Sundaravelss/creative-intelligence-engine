"""Hermes-CLI adapter — spawns nousresearch/hermes-agent as a subprocess.

Hermes is itself a model-agnostic agent runtime. We invoke it in **one-shot
mode** (``hermes -z PROMPT``) which sends a single prompt and prints **only**
the final response text to stdout (no banner, no spinner, no JSONL events).

Verified against Hermes Agent v0.14.0 on 2026-05-16:
  - non-interactive flag: ``-z PROMPT`` (a.k.a. ``--oneshot PROMPT``)
  - output: plain text on stdout
  - model override: ``-m MODEL_ID``
  - provider override: ``--provider PROVIDER`` (e.g. ``bedrock``, ``anthropic``,
    ``openrouter``, ``nous``)
  - session resume: ``--resume SESSION``

For Bedrock-backed Claude Opus 4.6 (the project's preferred path), set::

    HERMES_CLI_MODEL=eu.anthropic.claude-opus-4-6-v1
    HERMES_CLI_PROVIDER=bedrock
    AWS_REGION=eu-west-1
    AWS_ACCESS_KEY_ID=...
    AWS_SECRET_ACCESS_KEY=...

Anthropic use-case form must be approved on the AWS account first; otherwise
Bedrock returns ``ResourceNotFoundException: Model use case details have not
been submitted``.

Env vars
--------
``HERMES_CLI_PATH``        Path to ``hermes``. Default ``hermes`` (PATH).
``HERMES_CLI_MODEL``       Optional ``-m`` override (otherwise uses ``hermes config``).
``HERMES_CLI_PROVIDER``    Optional ``--provider`` (bedrock / anthropic / etc).
``HERMES_CLI_TIMEOUT_SEC`` Subprocess timeout in seconds (default 120).
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

    # Hermes one-shot mode. ``-z`` prints only the final response text on
    # stdout (no JSONL stream, no banner, no spinner) — perfect for adapter
    # use. Verified against Hermes Agent v0.14.0.
    cmd: list[str] = [binary, "-z", prompt]

    model_override = os.environ.get("HERMES_CLI_MODEL", "").strip()
    if model_override:
        cmd += ["-m", model_override]

    provider_override = os.environ.get("HERMES_CLI_PROVIDER", "").strip()
    if provider_override:
        cmd += ["--provider", provider_override]

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
    stderr_buf = bytearray()

    async def _drain_stderr() -> None:
        if proc.stderr is None:
            return
        async for chunk in proc.stderr:
            stderr_buf.extend(chunk)

    async def _drain_stdout() -> None:
        """Hermes one-shot prints plain text. Some lines may still be JSON
        events (Hermes occasionally emits status info to stdout); we
        gracefully extract text chunks from those too."""
        if proc.stdout is None:
            return
        async for raw in proc.stdout:
            line = raw.decode("utf-8", errors="replace").rstrip("\n").rstrip("\r")
            if not line:
                continue
            # Try JSON first (defensive — handles future Hermes flag changes).
            try:
                evt = json.loads(line)
            except json.JSONDecodeError:
                text_parts.append(line + "\n")
                await _emit(ctx, "stdout", line)
                continue
            chunk = _extract_chunk(evt) if isinstance(evt, dict) else ""
            if chunk:
                text_parts.append(chunk)
                await _emit(ctx, "stdout", chunk)

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

    text = "".join(text_parts).strip()

    # Hermes one-shot returns rc=0 even when the underlying provider call
    # failed — it just prints the provider's error to stdout. Detect those
    # error patterns and convert to a non-zero exit so the runtime advances
    # to the next adapter in the fallback chain.
    if _looks_like_hermes_error(text):
        return AdapterExecutionResult(
            exit_code=1,
            error=f"hermes_cli provider error: {text[:200]}",
            result_json={"text": "", "provider": "hermes_cli"},
        )

    return AdapterExecutionResult(
        exit_code=0,
        usage=UsageSummary(),  # Hermes one-shot doesn't expose token counts
        result_json={
            "text": text,
            "model": model_override or "hermes-cli-default",
            "provider": "hermes_cli",
        },
    )


# Patterns Hermes emits to stdout (with rc=0) when the underlying provider
# call fails. Match conservatively so a legitimate response that mentions
# "API call" doesn't trigger a false positive.
_ERROR_PATTERNS: tuple[str, ...] = (
    "API call failed after",
    "ResourceNotFoundException",
    "ValidationException",
    "AccessDeniedException",
    "ThrottlingException",
    "ModelNotReadyException",
    "Provider not configured",
    "Authentication failed",
    "No API key",
)


def _looks_like_hermes_error(text: str) -> bool:
    if not text:
        return False
    head = text[:500]
    return any(pat in head for pat in _ERROR_PATTERNS)


__all__ = ["execute", "HermesCliNotConfigured"]
