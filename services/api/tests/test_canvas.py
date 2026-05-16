"""Smoke tests for the canvas router (pins + characters)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_API_DIR = Path(__file__).resolve().parent.parent
if str(_API_DIR) not in sys.path:
    sys.path.insert(0, str(_API_DIR))

from main import app  # noqa: E402


@pytest.fixture
def client(tmp_path, monkeypatch):
    """Patch the canvas storage paths to a tmp dir so tests don't touch fixtures/."""
    from routers import canvas as canvas_router

    monkeypatch.setattr(canvas_router, "_PINS_FILE", tmp_path / "pins.json")
    monkeypatch.setattr(
        canvas_router, "_CHARACTERS_FILE", tmp_path / "characters.json"
    )
    return TestClient(app)


def test_pins_create_list_delete(client: TestClient) -> None:
    res = client.post(
        "/api/canvas/pins",
        json={"id": "pin_1", "url": "https://example.com/a.png"},
    )
    assert res.status_code == 200
    assert res.json()["id"] == "pin_1"

    res = client.get("/api/canvas/pins")
    assert res.status_code == 200
    assert len(res.json()) == 1

    res = client.delete("/api/canvas/pins/pin_1")
    assert res.status_code == 200
    assert client.get("/api/canvas/pins").json() == []


def test_pin_delete_404_when_missing(client: TestClient) -> None:
    res = client.delete("/api/canvas/pins/does-not-exist")
    assert res.status_code == 404


def test_character_round_trip(client: TestClient) -> None:
    payload = {
        "id": "char_neon",
        "name": "Neon",
        "persona": "tokyo skater, cyberpunk palette",
        "referenceUrls": ["https://example.com/ref.png"],
    }
    res = client.post("/api/canvas/characters", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == "char_neon"
    assert body["referenceUrls"] == ["https://example.com/ref.png"]

    res = client.get("/api/canvas/characters")
    assert res.status_code == 200
    assert any(c["id"] == "char_neon" for c in res.json())

    res = client.delete("/api/canvas/characters/char_neon")
    assert res.status_code == 200


def test_character_assigns_id_when_missing(client: TestClient) -> None:
    payload = {"id": "", "name": "n", "persona": "p"}
    res = client.post("/api/canvas/characters", json=payload)
    assert res.status_code == 200
    new_id = res.json()["id"]
    assert new_id and new_id.startswith("char_")
