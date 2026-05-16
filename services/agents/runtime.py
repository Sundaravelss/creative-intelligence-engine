"""Adapter dispatcher with fallback chain.

Resolves the adapter from ``ctx.config["adapter"]`` or the ``DEFAULT_ADAPTER``
env var, then tries adapters in priority order until one succeeds.
"""

from __future__ import annotations

import logging
import os
from typing import Iterable

from . import registry
from .contract import AdapterExecutionContext, AdapterExecutionResult

logger = logging.getLogger(__name__)

# Active 3-adapter chain: Pioneer (sponsor) → local Claude CLI → OpenAI.
# Hermes-CLI and Together are still registered and selectable per-request via
# `?adapter=hermes_cli` or `ADAPTER_FALLBACK_CHAIN`, just not in the default
# chain — Hermes-CLI's Bedrock provider needs the Anthropic use-case form
# approved on the personal AWS account first.
_DEFAULT_FALLBACK_CHAIN: tuple[str, ...] = (
    "pioneer",
    "claude_code",
    "openai",
)


def _resolve_chain(preferred: str, override_chain: str = "") -> list[str]:
    """Build the ordered adapter list with `preferred` first.

    Priority for the chain itself:
      1. ``override_chain`` (per-request, e.g. from ``ctx.config["fallback_chain"]``)
      2. ``ADAPTER_FALLBACK_CHAIN`` env var
      3. Built-in ``_DEFAULT_FALLBACK_CHAIN``
    """
    chain_str = (
        override_chain.strip()
        or os.environ.get("ADAPTER_FALLBACK_CHAIN", "").strip()
    )
    chain: Iterable[str]
    if chain_str:
        chain = (name.strip() for name in chain_str.split(",") if name.strip())
    else:
        chain = _DEFAULT_FALLBACK_CHAIN

    seen: set[str] = set()
    ordered: list[str] = []
    if preferred and preferred not in seen:
        ordered.append(preferred)
        seen.add(preferred)
    for name in chain:
        if name not in seen:
            ordered.append(name)
            seen.add(name)
    return ordered


async def _emit(ctx: AdapterExecutionContext, stream: str, message: str) -> None:
    if ctx.on_log is not None:
        await ctx.on_log(stream, message)  # type: ignore[arg-type]


async def execute(ctx: AdapterExecutionContext) -> AdapterExecutionResult:
    """Dispatch an adapter execution with fallback.

    Priority:
      1. ``ctx.config["adapter"]`` (if set)
      2. ``DEFAULT_ADAPTER`` env var (defaults to "pioneer")
      3. Remaining adapters from ``ADAPTER_FALLBACK_CHAIN`` (or the built-in
         default chain).
    """
    preferred = (
        str(ctx.config.get("adapter") or "").strip()
        or os.environ.get("DEFAULT_ADAPTER", "pioneer").strip()
        or "pioneer"
    )
    override_chain = str(ctx.config.get("fallback_chain") or "").strip()
    chain = _resolve_chain(preferred, override_chain)

    last_error: Exception | None = None
    for name in chain:
        try:
            adapter_fn = registry.get(name)
        except KeyError as exc:
            logger.warning("Adapter '%s' not registered: %s", name, exc)
            last_error = exc
            continue

        await _emit(ctx, "stdout", f"[runtime] try adapter={name}\n")
        logger.info("runtime.execute: trying adapter=%s run_id=%s", name, ctx.run_id)
        try:
            result = await adapter_fn(ctx)
        except Exception as exc:  # noqa: BLE001 — we explicitly want fallback
            logger.warning("Adapter '%s' raised: %s", name, exc)
            await _emit(ctx, "stderr", f"[runtime] adapter={name} raised: {exc}\n")
            last_error = exc
            continue

        if (result.exit_code or 0) != 0:
            logger.warning(
                "Adapter '%s' returned non-zero exit (%s): %s",
                name,
                result.exit_code,
                result.error,
            )
            last_error = RuntimeError(result.error or f"{name} exit={result.exit_code}")
            continue

        return result

    # All adapters failed. Don't bubble a hard error to the user — return
    # exit_code=0 with empty text + a meta flag so the campaign continues
    # gracefully (downstream nodes parse JSON safely; the orchestrator's
    # garbage-fallback path covers empty text). The full error chain is in
    # the server log for the operator.
    msg = f"all adapters failed (chain={chain}): {last_error}"
    logger.error(msg)
    return AdapterExecutionResult(
        exit_code=0,
        result_json={
            "text": "",
            "provider": "none",
            "meta": {
                "all_adapters_failed": True,
                "chain": list(chain),
                "last_error": str(last_error) if last_error else None,
            },
        },
    )


__all__ = ["execute"]
