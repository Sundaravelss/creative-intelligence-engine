"""Tests for the onboarding state router.

Two cases that map directly to the demo flow:
  1. GET /api/onboarding/state with a missing fixture returns the default
     `{complete: false}` (the path the user hits on first boot).
  2. PUT then GET round-trips the full payload (Phase 5 "Proceed" persists
     `{complete: true, brandUrl, completedAt}` and W1's redirect logic reads
     it back on next boot).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Make `routers.*` and `main` importable when running pytest from either the
# repo root or services/api/ — same trick used in test_research.py.
_API_DIR = Path(__file__).resolve().parents[1]
if str(_API_DIR) not in sys.path:
    sys.path.insert(0, str(_API_DIR))

from routers import onboarding as onboarding_router  # noqa: E402

# fixtures/ lives at <repo-root>/fixtures
_FIXTURE = onboarding_router._FIXTURE  # noqa: SLF001 — intentional: matches prod path


@pytest.fixture()
def client() -> TestClient:
    from main import app

    return TestClient(app)


@pytest.fixture(autouse=True)
def _restore_onboarding_fixture():
    """Snapshot fixtures/onboarding.json so tests don't pollute repo state."""
    backup = _FIXTURE.read_bytes() if _FIXTURE.exists() else None
    yield
    if backup is None:
        _FIXTURE.unlink(missing_ok=True)
    else:
        _FIXTURE.write_bytes(backup)


@pytest.mark.unit
def test_onboarding_state_default_when_fixture_missing(client: TestClient) -> None:
    _FIXTURE.unlink(missing_ok=True)
    resp = client.get("/api/onboarding/state")
    assert resp.status_code == 200
    body = resp.json()
    assert body["complete"] is False
    assert body["brandUrl"] is None
    assert body["completedAt"] is None


@pytest.mark.unit
def test_onboarding_put_then_get_round_trips(client: TestClient) -> None:
    payload = {
        "complete": True,
        "brandUrl": "https://example.com",
        "completedAt": "2026-05-16T13:00:00Z",
    }
    put_resp = client.put("/api/onboarding/state", json=payload)
    assert put_resp.status_code == 200
    assert put_resp.json() == payload

    get_resp = client.get("/api/onboarding/state")
    assert get_resp.status_code == 200
    assert get_resp.json() == payload
