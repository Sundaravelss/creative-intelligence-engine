"""Adapter contract — Python port of my_paperclip/packages/adapter-utils/src/types.ts.

This is a *minimal* port focused on the four types WS-D needs to implement
adapter modules: AgentSpec, RuntimeState, AdapterExecutionContext,
AdapterExecutionResult. The full TypeScript surface (skill snapshots, model
profiles, environment-test contexts, quota windows) is intentionally left out
— we don't need it for the hackathon scope.

Frozen at end of WS-0. Adding fields is OK; renaming/removing requires a
coordinated change across services/agents/adapters/* and routers/agents.py.
"""

from __future__ import annotations

from typing import Any, Awaitable, Callable, Literal

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Agent identity
# ---------------------------------------------------------------------------


class AgentSpec(BaseModel):
    """Static description of an agent — name, role, prompt, adapter binding."""

    id: str
    name: str
    role: str
    instructions: str
    adapter_type: str
    adapter_config: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="allow")


# ---------------------------------------------------------------------------
# Runtime state — carried across adapter invocations within a campaign run
# ---------------------------------------------------------------------------


class RuntimeState(BaseModel):
    """Cross-invocation state. session_id resumes provider sessions; last_messages
    feed multi-turn flows; task_key correlates events for the orchestrator."""

    session_id: str | None = None
    last_messages: list[dict[str, Any]] = Field(default_factory=list)
    task_key: str | None = None

    model_config = ConfigDict(extra="allow")


# ---------------------------------------------------------------------------
# Execution context — passed to every adapter.execute(ctx) call
# ---------------------------------------------------------------------------

LogStream = Literal["stdout", "stderr"]
LogCallback = Callable[[LogStream, str], Awaitable[None]]


class AdapterExecutionContext(BaseModel):
    """Everything an adapter needs to do one turn of work.

    Mirrors AdapterExecutionContext from the TS contract but trimmed to fields
    relevant to the CIE hackathon scope (no SSH/sandbox targets, no JWT
    plumbing). `on_log` is optional and lets adapters stream progress back to
    the orchestrator without coupling to FastAPI specifics.
    """

    run_id: str
    agent: AgentSpec
    runtime: RuntimeState
    config: dict[str, Any] = Field(default_factory=dict)
    context: dict[str, Any] = Field(default_factory=dict)
    on_log: LogCallback | None = None

    # Pydantic v2 needs to know it's safe to hold a non-serializable callable.
    model_config = ConfigDict(arbitrary_types_allowed=True, extra="allow")


# ---------------------------------------------------------------------------
# Execution result — every adapter.execute(ctx) returns one of these
# ---------------------------------------------------------------------------


class UsageSummary(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    cached_input_tokens: int | None = None


class AdapterExecutionResult(BaseModel):
    exit_code: int | None = 0
    usage: UsageSummary = Field(default_factory=UsageSummary)
    session_params: dict[str, Any] | None = None
    cost_usd: float = 0.0
    result_json: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None

    model_config = ConfigDict(extra="allow")


__all__ = [
    "AgentSpec",
    "RuntimeState",
    "AdapterExecutionContext",
    "AdapterExecutionResult",
    "UsageSummary",
    "LogCallback",
    "LogStream",
]
