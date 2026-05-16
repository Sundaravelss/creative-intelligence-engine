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

_DEFAULT_FALLBACK_CHAIN: tuple[str, ...] = ("pioneer", "openai", "claude_code", "hermes")


def _resolve_chain(preferred: str) -> list[str]:
    """Build the ordered adapter list with `preferred` first."""
    env_chain = os.environ.get("ADAPTER_FALLBACK_CHAIN", "").strip()
    chain: Iterable[str]
    if env_chain:
        chain = (name.strip() for name in env_chain.split(",") if name.strip())
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
    chain = _resolve_chain(preferred)

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

    msg = f"all adapters failed (chain={chain}): {last_error}"
    logger.error(msg)
    return AdapterExecutionResult(exit_code=1, error=msg, result_json={"text": ""})


__all__ = ["execute"]
