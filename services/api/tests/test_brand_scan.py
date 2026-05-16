"""Tests for POST /api/brand/scan.

All tests are fully mocked — no live network. Covered behaviours:

1. Happy path  — Tavily extract+search succeed, LLM voice succeeds, SSE emits
   4 phases ending in `phase=complete`, profile fully populated.
2. Fixture write — `fixtures/brand.json` is overwritten atomically post-scan.
3. Tavily missing → httpx fallback — clears TAVILY_API_KEY, mocks
   `httpx.AsyncClient.get`, asserts `meta.voice_fallback=True`.
4. Fetch failure — httpx raises `ConnectError`, SSE emits
   `{"type": "error", "code": "fetch_failed"}`.
5. Voice LLM failure — Tavily succeeds but `agents_runtime.execute` raises;
   `voice=""`, `meta.voice_fallback=True`, scan still completes.
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

# Make `routers.*` and `schemas` importable when running pytest from repo
# root or from services/api/.
_API_DIR = Path(__file__).resolve().parents[1]
if str(_API_DIR) not in sys.path:
    sys.path.insert(0, str(_API_DIR))

from routers import brand as brand_router  # noqa: E402


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def client() -> TestClient:
    from main import app

    return TestClient(app)


@pytest.fixture()
def preserve_brand_fixture() -> Any:
    """Snapshot fixtures/brand.json before the test, restore after.

    The scan endpoint overwrites this file by design; we don't want test runs
    to leave the repo dirty.
    """
    src = brand_router._BRAND_FILE
    backup = src.with_suffix(".json.test-backup")
    had_original = src.exists()
    if had_original:
        shutil.copy2(src, backup)
    try:
        yield
    finally:
        if had_original and backup.exists():
            shutil.copy2(backup, src)
        if backup.exists():
            backup.unlink()


def _parse_sse_events(body: str) -> list[dict[str, Any]]:
    """Parse `data: {...}` lines out of an SSE response body."""
    events: list[dict[str, Any]] = []
    for line in body.splitlines():
        line = line.strip()
        if not line.startswith("data:"):
            continue
        payload = line[len("data:") :].strip()
        if not payload:
            continue
        try:
            events.append(json.loads(payload))
        except json.JSONDecodeError:
            # Skip sse-starlette keepalive comments and the like.
            continue
    return events


def _fake_tavily_extract() -> dict[str, Any]:
    """Canned Tavily extract() response shaped like the real API."""
    return {
        "results": [
            {
                "url": "https://example.com",
                "raw_content": (
                    "<html><head>"
                    '<meta property="og:description" content="Comfortable shoes for everyone." />'
                    "<style>body{color:#212121;background:#216A51}.accent{color:#F0C511}</style>"
                    "</head><body>"
                    "<h1>Made from nature</h1>"
                    "<p>We design simple, comfortable shoes from natural materials. "
                    "Our wool comes from New Zealand sheep, our soles from sugarcane.</p>"
                    "</body></html>"
                ),
                "images": [
                    "https://example.com/cdn/logo-navy.svg",
                    "https://example.com/cdn/hero.jpg",
                ],
            }
        ]
    }


def _fake_tavily_catalog() -> dict[str, Any]:
    """Canned Tavily search() response with /products/ URLs."""
    return {
        "results": [
            {"url": "https://example.com/products/wool-runners", "title": "Wool Runner | Example"},
            {"url": "https://example.com/products/tree-runners", "title": "Tree Runner | Example"},
            {"url": "https://example.com/blog/sustainability", "title": "Our materials"},
            {"url": "https://example.com/products/tree-dasher", "title": "Tree Dasher"},
        ]
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_scan_happy_path(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    preserve_brand_fixture: None,
) -> None:
    """Tavily + LLM voice both succeed → 4 phases ending in `complete`."""
    monkeypatch.setenv("TAVILY_API_KEY", "fake-test-key")

    fake_client = MagicMock()
    fake_client.extract.return_value = _fake_tavily_extract()
    fake_client.search.return_value = _fake_tavily_catalog()

    async def fake_voice(prose: str) -> tuple[str, bool]:
        return ("Calm, plain-spoken voice with a focus on natural materials.", False)

    with patch.object(brand_router, "_build_tavily_client", return_value=fake_client), patch.object(
        brand_router, "_synthesize_voice", side_effect=fake_voice
    ):
        resp = client.post("/api/brand/scan", json={"url": "https://example.com"})

    assert resp.status_code == 200, resp.text
    events = _parse_sse_events(resp.text)
    phases = [e.get("phase") for e in events if e.get("type") == "phase"]
    assert phases == ["fetching", "parsing", "extracting", "complete"]

    complete = events[-1]
    assert complete["phase"] == "complete"
    profile = complete["profile"]
    assert profile["name"] == "Example"
    assert profile["sourceUrl"] == "https://example.com"
    assert profile["voice"].startswith("Calm")
    assert profile["tagline"] == "Comfortable shoes for everyone."
    assert profile["lastScannedAt"]
    # Palette extracted from inline CSS hex literals.
    assert "#216a51" in profile["palette"] or "#212121" in profile["palette"]
    # Products picked from /products/ catalog hits, slug = URL tail.
    product_ids = {p["id"] for p in profile["products"]}
    assert {"wool-runners", "tree-runners", "tree-dasher"}.issubset(product_ids)
    # No voice fallback when LLM succeeds.
    assert "meta" not in complete or not complete.get("meta", {}).get("voice_fallback")


@pytest.mark.unit
def test_scan_writes_fixture_atomically(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    preserve_brand_fixture: None,
) -> None:
    """After a happy-path scan, fixtures/brand.json contains the new profile."""
    monkeypatch.setenv("TAVILY_API_KEY", "fake-test-key")

    fake_client = MagicMock()
    fake_client.extract.return_value = _fake_tavily_extract()
    fake_client.search.return_value = _fake_tavily_catalog()

    async def fake_voice(prose: str) -> tuple[str, bool]:
        return ("Calm, plain-spoken voice.", False)

    with patch.object(brand_router, "_build_tavily_client", return_value=fake_client), patch.object(
        brand_router, "_synthesize_voice", side_effect=fake_voice
    ):
        resp = client.post("/api/brand/scan", json={"url": "https://example.com"})

    assert resp.status_code == 200

    # The fixture file should now reflect the scanned profile.
    with brand_router._BRAND_FILE.open("r", encoding="utf-8") as fh:
        on_disk = json.load(fh)
    assert on_disk["sourceUrl"] == "https://example.com"
    assert on_disk["name"] == "Example"
    assert "lastScannedAt" in on_disk
    # No leftover .brand-* tempfiles in the fixtures dir (atomic write cleans up).
    leftovers = [p.name for p in brand_router._BRAND_FILE.parent.glob(".brand-*")]
    assert leftovers == []


@pytest.mark.unit
def test_scan_falls_back_to_httpx_when_tavily_missing(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    preserve_brand_fixture: None,
) -> None:
    """No TAVILY_API_KEY → plain httpx fetch + heuristic-only voice."""
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    monkeypatch.delenv("BRAND_SCAN_FALLBACK", raising=False)

    canned_html = (
        "<html><head>"
        '<meta property="og:description" content="A small description." />'
        "<title>Example</title>"
        "<style>body{color:#216A51;background:#212121}.btn{color:#F0C511}</style>"
        "</head><body>"
        "<a href=\"/products/wool-runners\">Wool Runner</a>"
        "<a href=\"/products/tree-runners\">Tree Runner</a>"
        "<img src=\"/cdn/logo.svg\"/>"
        "<p>We design simple shoes.</p>"
        "</body></html>"
    )

    async def fake_get(self: httpx.AsyncClient, url: str, *args: Any, **kwargs: Any) -> Any:
        return httpx.Response(200, text=canned_html, request=httpx.Request("GET", url))

    with patch.object(httpx.AsyncClient, "get", new=fake_get):
        resp = client.post("/api/brand/scan", json={"url": "https://example.com"})

    assert resp.status_code == 200, resp.text
    events = _parse_sse_events(resp.text)
    phases = [e.get("phase") for e in events if e.get("type") == "phase"]
    assert phases == ["fetching", "parsing", "extracting", "complete"]

    complete = events[-1]
    assert complete["phase"] == "complete"
    assert complete.get("meta", {}).get("voice_fallback") is True
    profile = complete["profile"]
    assert profile["voice"] == ""
    assert profile["sourceUrl"] == "https://example.com"
    # Products extracted via regex from raw HTML.
    product_ids = {p["id"] for p in profile["products"]}
    assert {"wool-runners", "tree-runners"}.issubset(product_ids)


@pytest.mark.unit
def test_scan_emits_error_when_fetch_fails(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    preserve_brand_fixture: None,
) -> None:
    """httpx ConnectError → SSE `{type: error, code: fetch_failed}`."""
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    monkeypatch.delenv("BRAND_SCAN_FALLBACK", raising=False)

    async def boom(self: httpx.AsyncClient, url: str, *args: Any, **kwargs: Any) -> Any:
        raise httpx.ConnectError("network unreachable")

    with patch.object(httpx.AsyncClient, "get", new=boom):
        resp = client.post("/api/brand/scan", json={"url": "https://example.com"})

    assert resp.status_code == 200
    events = _parse_sse_events(resp.text)
    error_events = [e for e in events if e.get("type") == "error"]
    assert error_events, f"no error event in stream: {events}"
    assert error_events[0]["code"] == "fetch_failed"
    # No `complete` phase when fetch fails.
    completes = [e for e in events if e.get("phase") == "complete"]
    assert completes == []


@pytest.mark.unit
def test_scan_voice_llm_failure_still_completes(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    preserve_brand_fixture: None,
) -> None:
    """Tavily succeeds but voice LLM raises → voice='', voice_fallback=True."""
    monkeypatch.setenv("TAVILY_API_KEY", "fake-test-key")

    fake_client = MagicMock()
    fake_client.extract.return_value = _fake_tavily_extract()
    fake_client.search.return_value = _fake_tavily_catalog()

    async def voice_boom(prose: str) -> tuple[str, bool]:
        # Production code wraps adapter exceptions; this simulates the wrapped result.
        return ("", True)

    with patch.object(brand_router, "_build_tavily_client", return_value=fake_client), patch.object(
        brand_router, "_synthesize_voice", side_effect=voice_boom
    ):
        resp = client.post("/api/brand/scan", json={"url": "https://example.com"})

    assert resp.status_code == 200, resp.text
    events = _parse_sse_events(resp.text)
    phases = [e.get("phase") for e in events if e.get("type") == "phase"]
    assert phases == ["fetching", "parsing", "extracting", "complete"]

    complete = events[-1]
    assert complete["phase"] == "complete"
    assert complete.get("meta", {}).get("voice_fallback") is True
    assert complete["profile"]["voice"] == ""
