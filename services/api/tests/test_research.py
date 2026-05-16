"""Tests for the research router.

These cover the behaviour we actually care about in production:
1. Fixture fallback when TAVILY_API_KEY is missing (most common dev path).
2. Fixture fallback on timeout / upstream error (resilience).
3. Successful Tavily synthesis maps results to the Brief schema.
4. Validation rejects requests with neither url nor keyword.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

# Make `routers.*` and `schemas` importable when running pytest from the repo root
# or from services/api/.
_API_DIR = Path(__file__).resolve().parents[1]
if str(_API_DIR) not in sys.path:
    sys.path.insert(0, str(_API_DIR))

from routers import research as research_router  # noqa: E402
from schemas import Brief  # noqa: E402


@pytest.fixture()
def client() -> TestClient:
    from main import app

    return TestClient(app)


@pytest.fixture(autouse=True)
def _reset_fixture_cache() -> None:
    """Ensure each test sees a fresh fixture cache."""
    research_router._FIXTURE_CACHE = None  # noqa: SLF001 — test scaffolding


@pytest.mark.unit
def test_request_requires_url_or_keyword(client: TestClient) -> None:
    resp = client.post("/api/research", json={})
    assert resp.status_code == 422


@pytest.mark.unit
def test_returns_fixture_when_api_key_missing(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    resp = client.post("/api/research", json={"keyword": "sneaker drop"})
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body["hooks"], list)
    assert len(body["hooks"]) >= 5
    # Brief.audience / positioning are populated from fixtures.
    assert body["audience"]
    assert body["positioning"]


@pytest.mark.unit
def test_fixture_selection_is_deterministic(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    a = client.post("/api/research", json={"keyword": "sneaker drop"}).json()
    b = client.post("/api/research", json={"keyword": "sneaker drop"}).json()
    assert a == b


@pytest.mark.unit
def test_tavily_success_path(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """When Tavily returns data, we synthesize a Brief from it (no fixture)."""
    monkeypatch.setenv("TAVILY_API_KEY", "fake-test-key")

    fake_extract = [
        {"url": "https://example.com", "raw_content": "Premium running shoes built for elite athletes."}
    ]
    fake_search = [
        {"url": "https://nike.com/launch", "title": "Nike Air Max — bold launch hook"},
        {"url": "https://hoka.com/", "title": "Hoka — cushioned running redefined"},
    ]

    async def fake_call(
        url: str | None, keyword: str | None, api_key: str
    ) -> Brief:
        # Reuse internal helpers to keep behaviour close to production.
        comp = research_router._competitors_from_search(fake_search)  # noqa: SLF001
        hooks = research_router._hooks_from_search(fake_search, keyword)  # noqa: SLF001
        return Brief(
            url=url,
            keyword=keyword,
            audience=f"Inferred audience for '{keyword or url}'",
            competitors=comp,
            positioning=research_router._summarize_extract(fake_extract)[:280],  # noqa: SLF001
            hooks=hooks,
        )

    with patch.object(research_router, "_call_tavily", side_effect=fake_call):
        resp = client.post(
            "/api/research", json={"url": "https://example.com", "keyword": "running"}
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["url"] == "https://example.com"
    assert body["keyword"] == "running"
    assert "Nike" in body["competitors"]
    assert any("Nike" in h or "Hoka" in h for h in body["hooks"])
    assert "Premium running shoes" in body["positioning"]


@pytest.mark.unit
def test_tavily_timeout_falls_back_to_fixture(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("TAVILY_API_KEY", "fake-test-key")

    async def boom(*_: Any, **__: Any) -> Brief:
        raise asyncio.TimeoutError()

    with patch.object(research_router, "_call_tavily", side_effect=boom):
        resp = client.post("/api/research", json={"keyword": "saas trial"})

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["hooks"]) >= 5


@pytest.mark.unit
def test_tavily_error_falls_back_to_fixture(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("TAVILY_API_KEY", "fake-test-key")

    async def boom(*_: Any, **__: Any) -> Brief:
        raise RuntimeError("tavily exploded")

    with patch.object(research_router, "_call_tavily", side_effect=boom):
        resp = client.post("/api/research", json={"keyword": "coffee launch"})

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["hooks"]) >= 5


@pytest.mark.unit
def test_get_returns_405() -> None:
    from main import app

    client = TestClient(app)
    resp = client.get("/api/research")
    # FastAPI handles GET via our defensive handler → 405.
    assert resp.status_code == 405
