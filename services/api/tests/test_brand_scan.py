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


@pytest.fixture(autouse=True)
def _reset_scan_cache() -> Any:
    """Brand scan cache must not leak between tests.

    Each test exercises the full scan flow against `https://example.com`; if
    the cache survived between tests, later tests would replay stale events
    instead of re-running their mocks.
    """
    brand_router._SCAN_CACHE.clear()
    yield
    brand_router._SCAN_CACHE.clear()


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

    async def fake_synth(**_kwargs: Any) -> tuple[None, None]:
        # Fall through to _synthesize_voice path so the assertion suite still
        # exercises the legacy heuristic-extractor branch unchanged.
        return (None, None)

    with patch.object(brand_router, "_build_tavily_client", return_value=fake_client), patch.object(
        brand_router, "_synthesize_voice", side_effect=fake_voice
    ), patch.object(brand_router, "_llm_synthesize_brand", side_effect=fake_synth):
        resp = client.post("/api/brand/scan", json={"url": "https://example.com"})

    assert resp.status_code == 200, resp.text
    events = _parse_sse_events(resp.text)
    phases = [e.get("phase") for e in events if e.get("type") == "phase"]
    # Tavily-path scans emit `brand_md_refined` after `complete` when LLM
    # polishes the heuristic profile in the background.
    assert phases == ["fetching", "parsing", "extracting", "complete", "brand_md_refined"]

    complete = next(e for e in events if e.get("phase") == "complete")
    refined = events[-1]
    assert refined["phase"] == "brand_md_refined"

    # `complete` ships the heuristic profile so the user advances fast.
    heuristic = complete["profile"]
    assert heuristic["name"] == "Example"
    assert heuristic["sourceUrl"] == "https://example.com"
    assert heuristic["tagline"] == "Comfortable shoes for everyone."
    assert heuristic["lastScannedAt"]
    assert "#216a51" in heuristic["palette"] or "#212121" in heuristic["palette"]
    product_ids = {p["id"] for p in heuristic["products"]}
    assert {"wool-runners", "tree-runners", "tree-dasher"}.issubset(product_ids)

    # `brand_md_refined` carries the LLM-enriched profile (here: voice from
    # the rescue helper since `_llm_synthesize_brand` was stubbed to None).
    polished = refined["profile"]
    assert polished["voice"].startswith("Calm")
    assert refined.get("brandMd")


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

    async def fake_synth(**_kwargs: Any) -> tuple[None, None]:
        return (None, None)

    with patch.object(brand_router, "_build_tavily_client", return_value=fake_client), patch.object(
        brand_router, "_synthesize_voice", side_effect=fake_voice
    ), patch.object(brand_router, "_llm_synthesize_brand", side_effect=fake_synth):
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
    # httpx-fallback path stops at `complete` (no LLM polish — kept offline-safe).
    assert phases == ["fetching", "parsing", "extracting", "complete"]

    complete = events[-1]
    assert complete["phase"] == "complete"
    profile = complete["profile"]
    # On fallback, voice is heuristic-only (empty unless extracted from HTML).
    assert profile.get("voice", "") == ""
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

    async def synth_boom(**_kwargs: Any) -> tuple[None, None]:
        # New v3.1 helper — return None,None to force the legacy voice fallback.
        return (None, None)

    with patch.object(brand_router, "_build_tavily_client", return_value=fake_client), patch.object(
        brand_router, "_synthesize_voice", side_effect=voice_boom
    ), patch.object(brand_router, "_llm_synthesize_brand", side_effect=synth_boom):
        resp = client.post("/api/brand/scan", json={"url": "https://example.com"})

    assert resp.status_code == 200, resp.text
    events = _parse_sse_events(resp.text)
    phases = [e.get("phase") for e in events if e.get("type") == "phase"]
    # On Tavily path the LLM polish still emits `brand_md_refined` even when
    # both LLM helpers fail (refined event reflects the heuristic profile).
    assert phases == ["fetching", "parsing", "extracting", "complete", "brand_md_refined"]

    complete = next(e for e in events if e.get("phase") == "complete")
    assert complete["profile"].get("voice", "") == ""
    refined = events[-1]
    assert refined["phase"] == "brand_md_refined"
    assert refined["profile"].get("voice", "") == ""


@pytest.mark.unit
def test_scan_cache_replays_fast(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    preserve_brand_fixture: None,
) -> None:
    """A second scan of the same URL replays from cache without invoking Tavily again."""
    monkeypatch.setenv("TAVILY_API_KEY", "fake-test-key")

    fake_client = MagicMock()
    fake_client.extract.return_value = _fake_tavily_extract()
    fake_client.search.return_value = _fake_tavily_catalog()

    async def fake_voice(prose: str) -> tuple[str, bool]:
        return ("Calm voice.", False)

    async def fake_synth(**_kwargs: Any) -> tuple[None, None]:
        return (None, None)

    with patch.object(brand_router, "_build_tavily_client", return_value=fake_client), patch.object(
        brand_router, "_synthesize_voice", side_effect=fake_voice
    ), patch.object(brand_router, "_llm_synthesize_brand", side_effect=fake_synth):
        first = client.post("/api/brand/scan", json={"url": "https://example.com"})
        assert first.status_code == 200
        assert fake_client.extract.call_count == 1
        assert fake_client.search.call_count == 1

        # Second scan against the same URL — cache MUST replay; no new
        # upstream calls.
        second = client.post("/api/brand/scan", json={"url": "https://example.com"})
        assert second.status_code == 200
        assert fake_client.extract.call_count == 1
        assert fake_client.search.call_count == 1

    events = _parse_sse_events(second.text)
    phases = [e.get("phase") for e in events if e.get("type") == "phase"]
    assert phases == ["fetching", "parsing", "extracting", "complete", "brand_md_refined"]
    # Cached events carry meta.cached=True so observers can detect replay.
    assert all(e.get("meta", {}).get("cached") is True for e in events if e.get("type") == "phase")


@pytest.mark.unit
def test_scan_runs_tavily_calls_in_parallel(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    preserve_brand_fixture: None,
) -> None:
    """Extract + search are gathered, so total wall time ≈ max() not sum()."""
    import time

    monkeypatch.setenv("TAVILY_API_KEY", "fake-test-key")

    SLEEP_S = 0.6  # each call sleeps this long; sequential = 1.2s, parallel ≈ 0.6s

    fake_client = MagicMock()

    def slow_extract(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        time.sleep(SLEEP_S)
        return _fake_tavily_extract()

    def slow_search(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        time.sleep(SLEEP_S)
        return _fake_tavily_catalog()

    fake_client.extract.side_effect = slow_extract
    fake_client.search.side_effect = slow_search

    async def fake_voice(prose: str) -> tuple[str, bool]:
        return ("", True)

    async def fake_synth(**_kwargs: Any) -> tuple[None, None]:
        return (None, None)

    with patch.object(brand_router, "_build_tavily_client", return_value=fake_client), patch.object(
        brand_router, "_synthesize_voice", side_effect=fake_voice
    ), patch.object(brand_router, "_llm_synthesize_brand", side_effect=fake_synth):
        t0 = time.time()
        resp = client.post("/api/brand/scan", json={"url": "https://example.com"})
        elapsed = time.time() - t0

    assert resp.status_code == 200
    # Parallel: ≤ ~1.5 × single call. Sequential would be ≥ 2 × single call.
    assert elapsed < 2 * SLEEP_S - 0.05, (
        f"Tavily calls ran sequentially (elapsed={elapsed:.2f}s, expected < {2 * SLEEP_S - 0.05:.2f}s)"
    )
