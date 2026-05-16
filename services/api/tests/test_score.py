"""Unit tests for WS-F Virality Predictor heuristic + endpoint blending.

Tests focus on behaviour that protects business value:
1. Heuristic returns a well-formed result for any (prompt, aspect, url) input.
2. Hooky prompts score higher on hookScore than vanilla prompts.
3. 9:16 reels outscore 16:9 landscape on the aspect axis (social channel default).
4. novelty is deterministic per prompt (same prompt → same novelty).
5. Endpoint falls back to heuristic-only when the LLM critique is unavailable
   and tags meta.fallback so the UI can surface degraded mode.
6. Endpoint blends LLM + heuristic when LLM returns valid JSON.
"""

from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from main import app
from routers.score import _heuristic_score, _parse_llm_floats


# ---------------------------------------------------------------------------
# Heuristic — pure function
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.parametrize(
    "prompt,aspect",
    [
        ("STOP scrolling — POV: you found the perfect sneaker", "9:16"),
        ("a calm landscape at sunset", "16:9"),
        ("3 hacks every founder needs! dolly zoom into the laptop", "1:1"),
    ],
)
def test_heuristic_returns_well_formed_result(prompt: str, aspect: str) -> None:
    res = _heuristic_score(prompt=prompt, aspect=aspect)
    assert set(res.keys()) == {"viralScore", "hookScore", "holdRate", "breakdown"}
    for k in ("viralScore", "hookScore", "holdRate"):
        assert 0.0 <= res[k] <= 1.0, f"{k} out of [0,1]: {res[k]}"
    bd = res["breakdown"]
    assert set(bd.keys()) == {"aspect", "motion", "hookDensity", "contrast", "novelty"}
    for axis, v in bd.items():
        assert 0.0 <= v <= 1.0, f"breakdown.{axis} out of [0,1]: {v}"


@pytest.mark.unit
def test_hooky_prompt_outscores_vanilla_on_hookscore() -> None:
    hooky = _heuristic_score(prompt="STOP! 3 reasons you need this", aspect="9:16")
    vanilla = _heuristic_score(prompt="a serene mountain at dawn", aspect="9:16")
    assert hooky["hookScore"] > vanilla["hookScore"], (
        f"hooky {hooky['hookScore']} should beat vanilla {vanilla['hookScore']}"
    )


@pytest.mark.unit
def test_aspect_axis_favors_social_formats() -> None:
    reel = _heuristic_score(prompt="x", aspect="9:16")["breakdown"]["aspect"]
    landscape = _heuristic_score(prompt="x", aspect="16:9")["breakdown"]["aspect"]
    assert reel > landscape


@pytest.mark.unit
def test_novelty_is_deterministic_per_prompt() -> None:
    a = _heuristic_score(prompt="winter sneaker drop", aspect="9:16")["breakdown"]["novelty"]
    b = _heuristic_score(prompt="winter sneaker drop", aspect="9:16")["breakdown"]["novelty"]
    c = _heuristic_score(prompt="something else entirely", aspect="9:16")["breakdown"]["novelty"]
    assert a == b
    assert a != c


@pytest.mark.unit
def test_parse_llm_floats_tolerates_extra_text() -> None:
    out = _parse_llm_floats('Here is your score: {"viral": 0.7, "hook": 0.8, "hold": 0.6}')
    assert out == {"viral": 0.7, "hook": 0.8, "hold": 0.6}

    # Out-of-range values get clamped
    clamped = _parse_llm_floats('{"viral": 1.7, "hook": -0.2, "hold": 0.5}')
    assert clamped == {"viral": 1.0, "hook": 0.0, "hold": 0.5}

    # Missing key → returns None (signals fallback)
    assert _parse_llm_floats('{"viral": 0.5, "hook": 0.5}') is None
    assert _parse_llm_floats("not json at all") is None


# ---------------------------------------------------------------------------
# Endpoint — blending behaviour
# ---------------------------------------------------------------------------


@pytest.mark.integration
def test_endpoint_falls_back_when_llm_unavailable() -> None:
    """When the LLM critique pass raises (WS-D not wired), endpoint must
    return a valid ScoreResult tagged meta.fallback = 'heuristic-only'."""
    client = TestClient(app)

    async def _none(**_kwargs):  # type: ignore[no-untyped-def]
        return None

    with patch("routers.score._llm_critique", side_effect=_none):
        resp = client.post(
            "/api/score",
            json={"prompt": "STOP scrolling now", "aspect": "9:16"},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["meta"]["fallback"] == "heuristic-only"
    assert 0 <= body["viralScore"] <= 100
    assert 0.0 <= body["hookScore"] <= 1.0
    assert 0.0 <= body["holdRate"] <= 1.0
    assert set(body["breakdown"].keys()) == {
        "aspect", "motion", "hookDensity", "contrast", "novelty",
    }


@pytest.mark.integration
def test_endpoint_blends_when_llm_succeeds() -> None:
    """When the LLM returns valid {viral,hook,hold}, the final result is a
    50/50 blend and meta carries both halves so the UI can show provenance."""
    client = TestClient(app)

    async def _llm(**_kwargs):  # type: ignore[no-untyped-def]
        return {"viral": 1.0, "hook": 1.0, "hold": 1.0}

    with patch("routers.score._llm_critique", side_effect=_llm):
        resp = client.post(
            "/api/score",
            json={"prompt": "a calm landscape", "aspect": "16:9"},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "fallback" not in body["meta"]
    assert "llm" in body["meta"]
    assert "heuristic" in body["meta"]
    # Heuristic for a calm landscape on 16:9 should be well below 100;
    # LLM gives 1.0; blended 0..100 must sit strictly between heuristic and 100.
    h_viral_100 = int(round(body["meta"]["heuristic"]["viralScore"] * 100))
    assert h_viral_100 < body["viralScore"] <= 100
