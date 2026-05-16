"""Tests for the loops router.

What matters:
1. Create persists a loop with a generated id; list returns it.
2. run-now produces a post tagged with loop_id and returns its envelope.
3. /runs returns only posts tagged for that loop.
4. Delete removes the loop; subsequent run-now is 404.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_API_DIR = Path(__file__).resolve().parents[1]
if str(_API_DIR) not in sys.path:
    sys.path.insert(0, str(_API_DIR))

from routers import loops as loops_router  # noqa: E402
from routers import publish as publish_router  # noqa: E402


@pytest.fixture()
def client() -> TestClient:
    from main import app

    return TestClient(app)


@pytest.fixture(autouse=True)
def _isolate_fixtures() -> None:
    loops_path = loops_router._LOOPS_PATH  # noqa: SLF001
    posts_path = publish_router._POSTS_PATH  # noqa: SLF001

    loops_backup = loops_path.with_suffix(".bak") if loops_path.exists() else None
    posts_backup = posts_path.with_suffix(".bak")

    if loops_backup is not None:
        shutil.copy2(loops_path, loops_backup)
    shutil.copy2(posts_path, posts_backup)

    loops_path.write_text("[]\n")
    posts_path.write_text("[]\n")
    try:
        yield
    finally:
        if loops_backup is not None and loops_backup.exists():
            shutil.copy2(loops_backup, loops_path)
            loops_backup.unlink(missing_ok=True)
        elif loops_path.exists():
            loops_path.unlink(missing_ok=True)
        shutil.copy2(posts_backup, posts_path)
        posts_backup.unlink(missing_ok=True)


@pytest.mark.unit
def test_create_and_list_loop(client: TestClient) -> None:
    payload = {
        "name": "Daily IG",
        "cron": "0 9 * * *",
        "channel": "instagram",
        "prompt": "Daily product highlight",
        "format": "post",
    }
    created = client.post("/api/loops", json=payload).json()
    assert created["id"].startswith("loop_")
    assert created["created_at"]

    listed = client.get("/api/loops").json()
    assert len(listed) == 1
    assert listed[0]["id"] == created["id"]


@pytest.mark.unit
def test_run_now_publishes_and_history_filters(client: TestClient) -> None:
    a = client.post(
        "/api/loops",
        json={
            "name": "A",
            "cron": "0 9 * * *",
            "channel": "instagram",
            "prompt": "p",
            "format": "post",
        },
    ).json()
    b = client.post(
        "/api/loops",
        json={
            "name": "B",
            "cron": "0 10 * * *",
            "channel": "tiktok",
            "prompt": "q",
            "format": "post",
        },
    ).json()

    run_a = client.post(f"/api/loops/{a['id']}/run-now").json()
    run_b = client.post(f"/api/loops/{b['id']}/run-now").json()
    assert run_a["loop_id"] == a["id"]
    assert run_b["loop_id"] == b["id"]

    runs_a = client.get(f"/api/loops/{a['id']}/runs").json()
    assert len(runs_a) == 1
    assert runs_a[0]["post_id"] == run_a["post_id"]


@pytest.mark.unit
def test_delete_loop(client: TestClient) -> None:
    created = client.post(
        "/api/loops",
        json={
            "name": "tmp",
            "cron": "0 9 * * *",
            "channel": "x",
            "prompt": "p",
            "format": "post",
        },
    ).json()
    resp = client.delete(f"/api/loops/{created['id']}")
    assert resp.status_code == 200
    assert client.get("/api/loops").json() == []
    assert client.post(f"/api/loops/{created['id']}/run-now").status_code == 404
