"""Tests for the connectors router.

Covers what we actually care about:
1. List returns the seeded set with at least 25 entries across 7 categories.
2. AI-backend status is overlaid from env (OPENAI_API_KEY etc.).
3. Connect flips status + sets lastSync; disconnect reverses.
4. Connecting an unknown id returns 404.
5. Coming-soon connectors cannot be connected.
6. Writes are atomic — original fixture is restored after each test.
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_API_DIR = Path(__file__).resolve().parents[1]
if str(_API_DIR) not in sys.path:
    sys.path.insert(0, str(_API_DIR))

from routers import connectors as connectors_router  # noqa: E402


@pytest.fixture()
def client() -> TestClient:
    from main import app

    return TestClient(app)


@pytest.fixture(autouse=True)
def _restore_fixture() -> None:
    """Snapshot the connectors fixture and restore it after each test."""
    path = connectors_router._CONNECTORS_PATH  # noqa: SLF001
    backup = path.with_suffix(".bak")
    shutil.copy2(path, backup)
    try:
        yield
    finally:
        shutil.copy2(backup, path)
        backup.unlink(missing_ok=True)


@pytest.mark.unit
def test_list_returns_seeded_connectors(client: TestClient) -> None:
    resp = client.get("/api/connectors")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) >= 25
    categories = {c["category"] for c in body}
    assert {
        "ad-platforms",
        "social",
        "analytics",
        "commerce",
        "research",
        "email-crm",
        "ai-backends",
    } <= categories


@pytest.mark.unit
def test_ai_backend_status_overlaid_from_env(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Force-disconnect openai in the fixture by direct edit, then prove env overlays it.
    path = connectors_router._CONNECTORS_PATH  # noqa: SLF001
    data = json.loads(path.read_text())
    for entry in data:
        if entry["id"] == "openai":
            entry["status"] = "not-connected"
    path.write_text(json.dumps(data))

    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    resp = client.get("/api/connectors")
    body = resp.json()
    openai = next(c for c in body if c["id"] == "openai")
    assert openai["status"] == "connected"


@pytest.mark.unit
def test_connect_then_disconnect_cycle(client: TestClient) -> None:
    target = "instagram"
    r1 = client.post(f"/api/connectors/{target}/connect", json={"username": "x", "api_key": "y"})
    assert r1.status_code == 200
    assert r1.json()["status"] == "connected"
    assert r1.json().get("lastSync")

    r2 = client.delete(f"/api/connectors/{target}/connect")
    assert r2.status_code == 200
    assert r2.json()["status"] == "not-connected"


@pytest.mark.unit
def test_connect_unknown_id_returns_404(client: TestClient) -> None:
    resp = client.post("/api/connectors/does-not-exist/connect", json={})
    assert resp.status_code == 404


@pytest.mark.unit
def test_cannot_connect_coming_soon(client: TestClient) -> None:
    # linkedin-ads is seeded as coming-soon
    resp = client.post("/api/connectors/linkedin-ads/connect", json={})
    assert resp.status_code == 409
