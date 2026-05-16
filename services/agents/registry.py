"""Adapter registry. WS-D adapters register themselves at import time.

Mirror of my_paperclip/server/src/adapters/registry.ts but Python-native.
Five adapters are registered when this module is imported:
``pioneer``, ``openai``, ``claude_code``, ``hermes_cli``, ``together``. The
deprecated ``hermes`` name is aliased to ``together`` for one release.
"""

from __future__ import annotations

from typing import Awaitable, Callable

from .contract import AdapterExecutionContext, AdapterExecutionResult

AdapterFn = Callable[[AdapterExecutionContext], Awaitable[AdapterExecutionResult]]

ADAPTERS: dict[str, AdapterFn] = {}


def register(name: str, fn: AdapterFn) -> None:
    """Register an adapter under `name`. Last registration wins (allows overrides
    in tests)."""
    ADAPTERS[name] = fn


def get(name: str) -> AdapterFn:
    """Resolve an adapter by name or raise KeyError with a friendly message."""
    if name not in ADAPTERS:
        available = ", ".join(sorted(ADAPTERS.keys())) or "<none registered>"
        raise KeyError(f"Adapter '{name}' is not registered. Available: {available}")
    return ADAPTERS[name]


def names() -> list[str]:
    return sorted(ADAPTERS.keys())


# ---------------------------------------------------------------------------
# Register adapters. Avoid shadowing the built-in `openai` module name on
# this module's globals.
# ---------------------------------------------------------------------------
from .adapters import claude_code as _claude_code  # noqa: E402
from .adapters import hermes_cli as _hermes_cli  # noqa: E402
from .adapters import openai as _openai_mod  # noqa: E402
from .adapters import pioneer as _pioneer  # noqa: E402
from .adapters import together as _together  # noqa: E402

register("pioneer", _pioneer.execute)
register("openai", _openai_mod.execute)
register("claude_code", _claude_code.execute)
register("hermes_cli", _hermes_cli.execute)
register("together", _together.execute)
# Deprecated alias — old `?adapter=hermes` requests still resolve to Together.
# Drop after one release.
register("hermes", _together.execute)


__all__ = ["ADAPTERS", "AdapterFn", "register", "get", "names"]
