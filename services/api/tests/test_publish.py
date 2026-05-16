"""Tests for the publish router.

What matters:
1. POST /api/publish/{channel} returns post_id, channel, posted_at, insights.
2. Insights match the slice in fixtures/insights.json for the channel.
3. Each call appends a record to fixtures/posts.json (atomic).
4. Unknown channel still returns 200 with empty insights (mock is permissive).
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

from routers import publish as publish_router  # noqa: E402


@pytest.fixture()
def client() -> TestClient:
    from main import app

    return TestClient(app)


@pytest.fixture(autouse=True)
def _restore_posts() -> None:
    path = publish_router._POSTS_PATH  # noqa: SLF001
    backup = path.with_suffix(".bak")
    shutil.copy2(path, backup)
    # Reset to empty list for a clean slate.
    path.write_text("[]\n")
    try:
        yield
    finally:
        shutil.copy2(backup, path)
        backup.unlink(missing_ok=True)


@pytest.mark.unit
def test_publish_returns_envelope_and_insights(client: TestClient) -> None:
    resp = client.post(
        "/api/publish/meta-ads", json={"copy": "Hello world", "artifact_id": "art_1"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["channel"] == "meta-ads"
    assert body["post_id"].startswith("mock_")
    assert body["posted_at"]
    assert body["insights"]["impressions"] == 12450


@pytest.mark.unit
def test_publish_appends_to_posts_fixture(client: TestClient) -> None:
    client.post("/api/publish/instagram", json={"copy": "first"})
    client.post("/api/publish/instagram", json={"copy": "second"})
    posts = json.loads(publish_router._POSTS_PATH.read_text())  # noqa: SLF001
    assert len(posts) == 2
    assert all(p["channel"] == "instagram" for p in posts)
    assert posts[0]["copy"] == "first"
    assert posts[1]["copy"] == "second"


@pytest.mark.unit
def test_publish_unknown_channel_returns_empty_insights(client: TestClient) -> None:
    resp = client.post("/api/publish/no-such-channel", json={})
    assert resp.status_code == 200
    body = resp.json()
    assert body["channel"] == "no-such-channel"
    assert body["insights"] == {}
