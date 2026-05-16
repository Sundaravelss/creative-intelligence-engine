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
