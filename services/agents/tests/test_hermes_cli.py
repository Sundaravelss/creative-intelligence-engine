"""Tests for the hermes_cli adapter (subprocess to nousresearch/hermes-agent).

The actual ``hermes`` binary may not be installed on dev machines, so every
test here mocks ``shutil.which`` and ``asyncio.create_subprocess_exec``.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

# Make `agents.*` importable from the repo root.
_SERVICES_DIR = Path(__file__).resolve().parents[2]
if str(_SERVICES_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVICES_DIR))

from agents.adapters import hermes_cli  # noqa: E402
from agents.contract import (  # noqa: E402
    AdapterExecutionContext,
    AgentSpec,
    RuntimeState,
)


def _ctx(prompt: str = "ping") -> AdapterExecutionContext:
    return AdapterExecutionContext(
        run_id="test_run",
        agent=AgentSpec(
            id="strategist",
            name="strategist",
            role="strategist",
            instructions="You are a strategist.",
            adapter_type="hermes_cli",
        ),
        runtime=RuntimeState(),
        config={},
        context={"prompt": prompt},
    )


class _FakeStream:
    """Async-iterable stand-in for asyncio subprocess stdout/stderr.

    Each entry in ``lines`` is yielded as a single bytes chunk terminated by
    ``\\n``. A final empty line is appended so iteration ends naturally.
    """

    def __init__(self, lines: list[str]):
        self._lines = [(line + "\n").encode() for line in lines]

    def __aiter__(self):
        return self._gen()

    async def _gen(self):
        for line in self._lines:
            yield line


class _FakeProc:
    def __init__(
        self,
        stdout_lines: list[str],
        stderr_lines: list[str] | None = None,
        rc: int = 0,
    ) -> None:
        self.stdout = _FakeStream(stdout_lines)
        self.stderr = _FakeStream(stderr_lines or [])
        self._rc = rc

    async def wait(self) -> int:
        return self._rc

    def kill(self) -> None:
        pass


@pytest.mark.asyncio
async def test_raises_when_binary_missing() -> None:
    with patch("agents.adapters.hermes_cli.shutil.which", return_value=None), patch.dict(
        "os.environ", {"HERMES_CLI_PATH": "hermes"}, clear=False
    ):
        with pytest.raises(hermes_cli.HermesCliNotConfigured):
            await hermes_cli.execute(_ctx())


@pytest.mark.asyncio
async def test_returns_text_when_subprocess_emits_stream_json() -> None:
    fake = _FakeProc(
        stdout_lines=[
            '{"type":"start"}',
            '{"delta":"Pitch a "}',
            '{"delta":"Reels ad "}',
            '{"text":"for wool sneakers."}',
            '{"usage":{"input_tokens":12,"output_tokens":34}}',
        ]
    )
    with patch(
        "agents.adapters.hermes_cli.shutil.which", return_value="/usr/local/bin/hermes"
    ), patch(
        "asyncio.create_subprocess_exec",
        AsyncMock(return_value=fake),
    ):
        result = await hermes_cli.execute(_ctx("Pitch a Reels ad."))
    assert result.exit_code == 0
    assert result.result_json["text"] == "Pitch a Reels ad for wool sneakers."
    assert result.result_json["provider"] == "hermes_cli"
    assert result.usage.input_tokens == 12
    assert result.usage.output_tokens == 34


@pytest.mark.asyncio
async def test_extracts_choices_delta_content_shape() -> None:
    """Some CLIs emit OpenAI-compatible chunks with ``choices[0].delta.content``."""
    fake = _FakeProc(
        stdout_lines=[
            '{"choices":[{"delta":{"content":"hello "}}]}',
            '{"choices":[{"delta":{"content":"world"}}]}',
        ]
    )
    with patch(
        "agents.adapters.hermes_cli.shutil.which", return_value="/usr/local/bin/hermes"
    ), patch(
        "asyncio.create_subprocess_exec",
        AsyncMock(return_value=fake),
    ):
        result = await hermes_cli.execute(_ctx())
    assert result.exit_code == 0
    assert result.result_json["text"] == "hello world"


@pytest.mark.asyncio
async def test_returns_nonzero_when_subprocess_fails() -> None:
    fake = _FakeProc(
        stdout_lines=[],
        stderr_lines=["fatal: model not configured"],
        rc=2,
    )
    with patch(
        "agents.adapters.hermes_cli.shutil.which", return_value="/usr/local/bin/hermes"
    ), patch(
        "asyncio.create_subprocess_exec",
        AsyncMock(return_value=fake),
    ):
        result = await hermes_cli.execute(_ctx())
    assert result.exit_code == 2
    assert "fatal: model not configured" in (result.error or "")


@pytest.mark.asyncio
async def test_falls_back_to_raw_text_when_lines_arent_json() -> None:
    """Hermes might fall back to plain text under some flag combos. Keep the output."""
    fake = _FakeProc(
        stdout_lines=[
            "Plain text line one",
            "Plain text line two",
        ]
    )
    with patch(
        "agents.adapters.hermes_cli.shutil.which", return_value="/usr/local/bin/hermes"
    ), patch(
        "asyncio.create_subprocess_exec",
        AsyncMock(return_value=fake),
    ):
        result = await hermes_cli.execute(_ctx())
    assert result.exit_code == 0
    # Both raw lines are concatenated (in order) into the text output.
    assert "Plain text line one" in result.result_json["text"]
    assert "Plain text line two" in result.result_json["text"]


@pytest.mark.asyncio
async def test_runtime_falls_through_when_hermes_cli_unconfigured() -> None:
    """Integration check: runtime.execute catches HermesCliNotConfigured cleanly."""
    from agents import runtime

    # Force the adapter chain to put hermes_cli first, then a synthetic adapter.
    captured: list[str] = []

    async def _stub(ctx):  # type: ignore[no-untyped-def]
        captured.append(ctx.config.get("adapter") or "default")
        from agents.contract import AdapterExecutionResult

        return AdapterExecutionResult(exit_code=0, result_json={"text": "ok"})

    from agents import registry

    original = registry.ADAPTERS.copy()
    try:
        registry.ADAPTERS["stub_ok"] = _stub
        with patch("agents.adapters.hermes_cli.shutil.which", return_value=None):
            ctx = _ctx()
            ctx.config["adapter"] = "hermes_cli"
            ctx.config["fallback_chain"] = "hermes_cli,stub_ok"
            result = await runtime.execute(ctx)
        assert result.exit_code == 0
        assert result.result_json["text"] == "ok"
    finally:
        registry.ADAPTERS.clear()
        registry.ADAPTERS.update(original)
