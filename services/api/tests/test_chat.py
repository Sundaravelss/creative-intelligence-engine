"""Tests for the chat session persistence router.

Each test uses an isolated in-memory SQLite via the ``CIE_DB_URL`` env var, so
the production ``fixtures/cie.db`` is never touched. The DB module is reloaded
between tests so the engine picks up the env override.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_API_DIR = Path(__file__).resolve().parents[1]
if str(_API_DIR) not in sys.path:
    sys.path.insert(0, str(_API_DIR))


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Build a TestClient backed by a fresh in-memory SQLite per test.

    Strategy: replace the ``db._engine`` with a fresh in-memory engine and
    re-create tables for each test. This avoids SQLModel's class-registry
    conflicts that occur when ``models_db`` is reimported.
    """
    # Import once; reuse on subsequent tests.
    db_mod = importlib.import_module("db")
    import models_db  # noqa: F401  — registers tables on shared metadata

    from sqlalchemy.pool import StaticPool
    from sqlmodel import SQLModel, create_engine

    fresh_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(fresh_engine)

    monkeypatch.setattr(db_mod, "_engine", fresh_engine)

    # main.py is fine to reuse — the chat router pulls session_scope() lazily
    # via db.session_scope, which now reads the patched _engine.
    if "main" not in sys.modules:
        importlib.import_module("main")
    main_mod = sys.modules["main"]
    return TestClient(main_mod.app)


@pytest.mark.unit
def test_create_session_returns_id_and_default_title(client: TestClient) -> None:
    resp = client.post("/api/chat/sessions", json={})
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"].startswith("cs_")
    assert body["title"] == "New chat"
    assert body["message_count"] == 0


@pytest.mark.unit
def test_list_sessions_orders_most_recent_first(client: TestClient) -> None:
    s1 = client.post("/api/chat/sessions", json={"title": "first"}).json()
    s2 = client.post("/api/chat/sessions", json={"title": "second"}).json()
    s3 = client.post("/api/chat/sessions", json={"title": "third"}).json()

    resp = client.get("/api/chat/sessions")
    assert resp.status_code == 200
    ids = [row["id"] for row in resp.json()]
    # Most recent first.
    assert ids[:3] == [s3["id"], s2["id"], s1["id"]]


@pytest.mark.unit
def test_append_messages_round_trip(client: TestClient) -> None:
    s = client.post("/api/chat/sessions", json={"adapter": "pioneer"}).json()
    sid = s["id"]

    for kind, payload in [
        ("user", {"content": "Pitch a Reels ad for wool sneakers."}),
        ("started", {"agentId": "shopos"}),
        (
            "thought",
            {"agentId": "strategist", "summary": "3 hooks for Gen-Z", "fullText": "..."},
        ),
    ]:
        r = client.post(f"/api/chat/sessions/{sid}/messages", json={"kind": kind, "payload": payload})
        assert r.status_code == 201
        assert r.json()["kind"] == kind

    full = client.get(f"/api/chat/sessions/{sid}").json()
    assert full["session"]["message_count"] == 3
    assert [m["kind"] for m in full["messages"]] == ["user", "started", "thought"]
    assert full["messages"][0]["payload"]["content"].startswith("Pitch")


@pytest.mark.unit
def test_patch_session_updates_title_and_adapter(client: TestClient) -> None:
    sid = client.post("/api/chat/sessions", json={}).json()["id"]
    r = client.patch(
        f"/api/chat/sessions/{sid}",
        json={"title": "Allbirds Reels", "adapter": "claude_code"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["title"] == "Allbirds Reels"
    assert body["adapter"] == "claude_code"


@pytest.mark.unit
def test_delete_session_cascades_messages(client: TestClient) -> None:
    sid = client.post("/api/chat/sessions", json={}).json()["id"]
    client.post(f"/api/chat/sessions/{sid}/messages", json={"kind": "user", "payload": {"content": "hi"}})
    r = client.delete(f"/api/chat/sessions/{sid}")
    assert r.status_code == 204
    assert client.get(f"/api/chat/sessions/{sid}").status_code == 404


@pytest.mark.unit
def test_get_unknown_session_returns_404(client: TestClient) -> None:
    assert client.get("/api/chat/sessions/cs_nonexistent").status_code == 404


@pytest.mark.unit
def test_append_to_unknown_session_returns_404(client: TestClient) -> None:
    r = client.post(
        "/api/chat/sessions/cs_nonexistent/messages",
        json={"kind": "user", "payload": {"content": "hi"}},
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# /api/chat/completions tests — sentinel-tag image-gen, persona threading
# ---------------------------------------------------------------------------


def _parse_sse(body: str) -> list[tuple[str, dict]]:
    """Tiny SSE parser. Returns [(event_name, parsed_data), ...].

    sse-starlette emits events terminated by ``\\r\\n\\r\\n``; we normalise to
    ``\\n`` first so this parser handles both line endings.
    """
    import json

    body = body.replace("\r\n", "\n")
    out: list[tuple[str, dict]] = []
    for block in body.split("\n\n"):
        block = block.strip()
        if not block:
            continue
        evt = "message"
        data_lines: list[str] = []
        for line in block.splitlines():
            if line.startswith("event:"):
                evt = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                data_lines.append(line.split(":", 1)[1].strip())
        try:
            payload = json.loads("\n".join(data_lines)) if data_lines else {}
        except json.JSONDecodeError:
            payload = {}
        out.append((evt, payload))
    return out


def _patch_runtime_with_text(
    monkeypatch: pytest.MonkeyPatch, text: str
) -> list[dict]:
    """Replace agents.runtime.execute with a fake that streams `text` via
    on_log then returns. Returns a list captured calls can append to.
    """
    captured: list[dict] = []

    async def _fake_execute(ctx):  # type: ignore[no-untyped-def]
        captured.append(
            {
                "agent_id": ctx.agent.id,
                "instructions": ctx.agent.instructions,
                "prompt": ctx.context.get("prompt"),
                "adapter": ctx.config.get("adapter"),
            }
        )
        if ctx.on_log is not None:
            # Push the entire response in 4 chunks so the parser must accumulate.
            n = max(1, len(text) // 4)
            for i in range(0, len(text), n):
                await ctx.on_log("stdout", text[i : i + n])
        from agents.contract import AdapterExecutionResult, UsageSummary

        return AdapterExecutionResult(
            exit_code=0,
            usage=UsageSummary(),
            result_json={"text": text, "provider": "fake"},
        )

    from agents import runtime as agent_runtime

    monkeypatch.setattr(agent_runtime, "execute", _fake_execute)
    return captured


@pytest.mark.unit
def test_chat_completions_streams_plain_reply(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A non-image prompt produces text_delta + text_done + done events."""
    _patch_runtime_with_text(monkeypatch, "Hi! I can help you with that.")

    resp = client.post(
        "/api/chat/completions",
        json={"messages": [{"role": "user", "content": "Hi, who are you?"}]},
    )
    assert resp.status_code == 200, resp.text
    events = _parse_sse(resp.text)
    types = [e for e, _ in events]
    assert "started" in types
    assert "text_delta" in types
    assert "text_done" in types
    assert "done" in types
    # No image generation triggered.
    assert "tool_use" not in types
    assert "artifact" not in types

    # Joined text matches what the fake adapter streamed.
    deltas = [d["chunk"] for e, d in events if e == "text_delta"]
    assert "".join(deltas) == "Hi! I can help you with that."

    final = next(d for e, d in events if e == "text_done")
    assert final["fullText"] == "Hi! I can help you with that."


@pytest.mark.unit
def test_chat_completions_dispatches_fal_on_image_sentinel(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """When the persona emits `<image .../>`, the backend calls FAL and
    emits tool_use + artifact, with the tag itself stripped from text."""
    sample = (
        'Sure, here\'s an editorial take — '
        '<image prompt="wool sneakers on cobblestone, golden hour" aspect="1:1" /> '
        "Hope that captures the mood."
    )
    _patch_runtime_with_text(monkeypatch, sample)

    # Monkey-patch the chat router's FAL helper so we don't hit network.
    from routers import chat as chat_router

    async def _fake_generate(
        prompt: str, aspect: str | None, reference_url: str | None = None
    ):
        return ("https://cdn.fal.test/img.png", None)

    monkeypatch.setattr(chat_router, "_generate_image", _fake_generate)

    resp = client.post(
        "/api/chat/completions",
        json={"messages": [{"role": "user", "content": "Show me wool runners"}]},
    )
    assert resp.status_code == 200, resp.text
    events = _parse_sse(resp.text)
    types = [e for e, _ in events]
    # 3 variants per sentinel: editorial / golden-hour / overcast.
    assert types.count("tool_use") == 3
    assert types.count("artifact") == 3

    tool_uses = [d for e, d in events if e == "tool_use"]
    assert all(tu["tool"] == "generate_image" for tu in tool_uses)
    assert all("wool sneakers" in tu["input"]["prompt"] for tu in tool_uses)
    # Variant labels show up in tool_use input for the chat to render distinct chips.
    labels = sorted(tu["input"]["variantLabel"] for tu in tool_uses)
    assert labels == ["editorial", "golden-hour", "overcast"]

    artifacts = [d["artifact"] for e, d in events if e == "artifact"]
    assert len(artifacts) == 3
    # All 3 share the same shotId so the carousel groups them as variants.
    shot_ids = {a["shotId"] for a in artifacts}
    assert len(shot_ids) == 1
    # All 3 carry distinct variantIds and the mocked URL.
    assert all(a["url"] == "https://cdn.fal.test/img.png" for a in artifacts)
    assert len({a["variantId"] for a in artifacts}) == 3
    assert {a["variantLabel"] for a in artifacts} == {
        "editorial",
        "golden-hour",
        "overcast",
    }

    # The literal `<image .../>` substring must NOT appear in any text_delta —
    # the parser swallows it.
    deltas = [d["chunk"] for e, d in events if e == "text_delta"]
    joined = "".join(deltas)
    assert "<image" not in joined
    assert "/>" not in joined
    assert joined.startswith("Sure, here's an editorial take —")
    assert joined.endswith("Hope that captures the mood.")


@pytest.mark.unit
def test_chat_completions_image_edit_passes_reference_url(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """When the persona emits a sentinel with `reference_url`, the backend
    routes each variant through the image-to-image FAL path (passing the
    upload URL through to FAL)."""
    sample = (
        "Three takes on it:\n"
        "1. Editorial studio\n"
        "2. Lifestyle on cobblestone\n"
        "3. Macro detail\n"
        '<image prompt="leather wallet on neutral background" aspect="1:1" '
        'reference_url="https://fal.cdn/uploads/abc.jpg" />'
    )
    _patch_runtime_with_text(monkeypatch, sample)

    captured_calls: list[dict] = []

    async def _fake_generate(
        prompt: str, aspect: str | None, reference_url: str | None = None
    ):
        captured_calls.append(
            {
                "prompt": prompt,
                "aspect": aspect,
                "reference_url": reference_url,
            }
        )
        return ("https://cdn.fal.test/edited.png", None)

    from routers import chat as chat_router

    monkeypatch.setattr(chat_router, "_generate_image", _fake_generate)

    resp = client.post(
        "/api/chat/completions",
        json={
            "messages": [
                {"role": "user", "content": "Make 3 reimaginings of my wallet"}
            ]
        },
    )
    assert resp.status_code == 200, resp.text
    events = _parse_sse(resp.text)

    # 3 variants, each routed through image-to-image with the same reference.
    assert len(captured_calls) == 3
    for call in captured_calls:
        assert call["reference_url"] == "https://fal.cdn/uploads/abc.jpg"
        assert call["aspect"] == "1:1"
        assert "leather wallet" in call["prompt"]

    # tool_use events use the "edit_image" tool name (vs "generate_image"
    # for from-scratch).
    tool_uses = [d for e, d in events if e == "tool_use"]
    assert len(tool_uses) == 3
    assert all(tu["tool"] == "edit_image" for tu in tool_uses)
    assert all(
        tu["input"]["referenceUrl"] == "https://fal.cdn/uploads/abc.jpg"
        for tu in tool_uses
    )


@pytest.mark.unit
def test_chat_completions_attachments_inject_reference_url_into_persona(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """When the request carries `attachments`, the persona's `instructions`
    field gets a hard directive: 'include reference_url=... on your sentinel'.

    This is the chain that fixes "I attached an image but Claude said it
    couldn't see it" — without this, Claude treats the URL as text noise.
    """
    captured = _patch_runtime_with_text(monkeypatch, "ok")

    resp = client.post(
        "/api/chat/completions",
        json={
            "messages": [{"role": "user", "content": "make 3 variations"}],
            "attachments": [
                {
                    "url": "https://fal.cdn/uploads/bag.jpg",
                    "filename": "bag.jpg",
                    "content_type": "image/jpeg",
                }
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    assert len(captured) == 1
    instructions = captured[0]["instructions"]
    assert "REFERENCE IMAGE ATTACHED" in instructions
    assert "https://fal.cdn/uploads/bag.jpg" in instructions
    assert 'reference_url="https://fal.cdn/uploads/bag.jpg"' in instructions

    # And the prompt also carries the <attached_image> block.
    user_prompt = captured[0]["prompt"]
    assert '<attached_image url="https://fal.cdn/uploads/bag.jpg"' in user_prompt


@pytest.mark.unit
def test_chat_completions_threads_persona_system_prompt(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Each agent_id sends a distinct system prompt to the adapter."""
    captured = _patch_runtime_with_text(monkeypatch, "Got it.")

    resp = client.post(
        "/api/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Plan a launch."}],
            "agent_id": "strategist",
        },
    )
    assert resp.status_code == 200
    assert len(captured) == 1
    instructions = captured[0]["instructions"]
    # The Mira Vox persona prompt is recognizable.
    assert "Mira Vox" in instructions
    assert "strategist" in instructions.lower()
    assert captured[0]["agent_id"] == "strategist"


@pytest.mark.unit
def test_chat_completions_unknown_agent_id_returns_404(client: TestClient) -> None:
    resp = client.post(
        "/api/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Hi"}],
            "agent_id": "nonexistent_persona_id",
        },
    )
    assert resp.status_code == 404
    body = resp.json()
    assert "nonexistent_persona_id" in str(body.get("detail", ""))
