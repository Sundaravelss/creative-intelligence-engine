"""Virality Predictor router (WS-F).

POST /api/score → ScoreResult.

Scoring strategy (final = 0.5 * heuristic + 0.5 * llm critique):

* Heuristic baseline — 5-axis breakdown computed from the prompt + artifact
  metadata. No external deps, fully deterministic per (prompt, aspect, url).
* LLM critique pass — calls services.agents.runtime.execute with a 1-shot
  critique prompt asking for {viral, hook, hold} floats in 0..1. If the agents
  service is not yet wired (WS-D parallel) or any error bubbles up, we
  gracefully fall back to heuristic-only and tag the response with
  meta.fallback = "heuristic-only".
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from schemas import ScoreBreakdown, ScoreResult

logger = logging.getLogger("cie.api.score")

router = APIRouter(prefix="/api/score", tags=["score"])


# ---------------------------------------------------------------------------
# Request / response shape
# ---------------------------------------------------------------------------


class ScoreRequest(BaseModel):
    artifact_id: str | None = Field(None, alias="artifactId")
    artifact_url: str | None = Field(None, alias="artifactUrl")
    prompt: str | None = None
    aspect: str | None = None  # "9:16" | "1:1" | "16:9" | "4:5" etc.

    model_config = {"populate_by_name": True, "extra": "ignore"}


# ---------------------------------------------------------------------------
# Heuristic axes
# ---------------------------------------------------------------------------

_ACTION_VERBS = {
    "run", "running", "jump", "jumping", "dance", "dancing", "spin", "spinning",
    "drop", "dropping", "explode", "exploding", "fly", "flying", "race",
    "racing", "smash", "kick", "throw", "throwing", "splash", "crash",
    "crashing", "slide", "sliding", "burst", "bursting", "rise", "rising",
    "fall", "falling", "shake", "shaking", "pulse", "pulsing", "rush",
    "rushing", "zoom", "swoop", "sprint", "leap", "swing", "swinging",
}

_CAMERA_TOKENS = {
    "pan", "tilt", "zoom", "dolly", "track", "tracking", "crane", "drone",
    "fly-through", "flythrough", "pov", "handheld", "steadicam", "orbit",
    "orbiting", "push-in", "pushin", "pullout", "pull-out",
    "close-up", "closeup", "wide", "macro", "telephoto",
}

_HOOK_TOKENS = {
    "stop", "wait", "don't", "dont", "pov:", "pov", "look", "watch",
    "warning", "secret", "nobody", "this", "imagine", "what",
}

_NUMBER_RE = re.compile(r"\b\d+\b")
_WORD_RE = re.compile(r"[A-Za-z']+|[0-9]+|[!?]")


def _aspect_score(aspect: str | None) -> float:
    """Reels (9:16) and squares (1:1) are baseline social formats → full points."""
    if not aspect:
        return 0.6
    a = aspect.replace(" ", "").lower()
    if a in {"9:16", "portrait", "reel", "story", "shorts", "tiktok"}:
        return 1.0
    if a in {"1:1", "square"}:
        return 0.95
    if a in {"4:5"}:
        return 0.8
    if a in {"16:9", "landscape"}:
        return 0.55
    return 0.5


def _motion_score(prompt: str | None) -> float:
    if not prompt:
        return 0.3
    tokens = [t.lower().strip(".,;:!?") for t in prompt.split()]
    hits = sum(1 for t in tokens if t in _ACTION_VERBS)
    cam_hits = sum(1 for t in tokens if t in _CAMERA_TOKENS)
    raw = (hits * 0.18) + (cam_hits * 0.22)
    return max(0.1, min(1.0, raw + 0.2))  # baseline 0.2 floor


def _hook_density_score(prompt: str | None) -> float:
    if not prompt:
        return 0.2
    # First 5 word-like tokens
    words = re.findall(r"\S+", prompt)[:5]
    head = " ".join(words).lower()

    score = 0.0
    for tok in _HOOK_TOKENS:
        if tok in head:
            score += 0.2
    if _NUMBER_RE.search(head):
        score += 0.15
    if "!" in head:
        score += 0.15
    if head and head.split()[0].isupper() and len(head.split()[0]) > 1:
        # First word ALL-CAPS, e.g. "STOP"
        score += 0.15
    return max(0.0, min(1.0, score))


def _contrast_score(artifact_url: str | None) -> float:
    """Placeholder — without pixel inspection we infer mildly from format."""
    if not artifact_url:
        return 0.7
    url = artifact_url.lower()
    if url.endswith((".png", ".webp")):
        return 0.78
    if url.endswith((".jpg", ".jpeg")):
        return 0.72
    if url.endswith((".mp4", ".mov", ".webm")):
        return 0.7
    return 0.7


def _novelty_score(prompt: str | None) -> float:
    """Deterministic-per-prompt pseudo-novelty: hash → 0..1."""
    seed_src = (prompt or "").strip().lower() or "empty"
    digest = hashlib.sha256(seed_src.encode("utf-8")).digest()
    # First 4 bytes → uint32 → 0..1 in [0.3, 0.95]
    n = int.from_bytes(digest[:4], "big") / 0xFFFFFFFF
    return round(0.3 + n * 0.65, 4)


def _heuristic_score(
    *,
    prompt: str | None = None,
    aspect: str | None = None,
    artifact_url: str | None = None,
) -> dict[str, Any]:
    """Compute the 5-axis heuristic breakdown + viral/hook/hold floats in 0..1.

    Returned shape matches what the LLM critique returns so that the two halves
    can be blended uniformly. Pure function — exported for unit tests.
    """
    breakdown = {
        "aspect": round(_aspect_score(aspect), 4),
        "motion": round(_motion_score(prompt), 4),
        "hookDensity": round(_hook_density_score(prompt), 4),
        "contrast": round(_contrast_score(artifact_url), 4),
        "novelty": round(_novelty_score(prompt), 4),
    }
    # Composite floats (0..1)
    viral = (
        0.3 * breakdown["hookDensity"]
        + 0.25 * breakdown["motion"]
        + 0.2 * breakdown["aspect"]
        + 0.15 * breakdown["novelty"]
        + 0.1 * breakdown["contrast"]
    )
    hook = 0.7 * breakdown["hookDensity"] + 0.3 * breakdown["aspect"]
    hold = 0.55 * breakdown["motion"] + 0.25 * breakdown["contrast"] + 0.2 * breakdown["novelty"]
    return {
        "viralScore": round(max(0.0, min(1.0, viral)), 4),
        "hookScore": round(max(0.0, min(1.0, hook)), 4),
        "holdRate": round(max(0.0, min(1.0, hold)), 4),
        "breakdown": breakdown,
    }


# ---------------------------------------------------------------------------
# LLM critique pass
# ---------------------------------------------------------------------------

_CRITIQUE_PROMPT = """You are a viral-content critic. Score the following ad creative on three axes.
Return ONLY a JSON object with float values in 0..1 (no prose, no code fences):
{{"viral": <0..1>, "hook": <0..1>, "hold": <0..1>}}

Creative prompt: {prompt}
Artifact URL: {url}
Aspect ratio: {aspect}
"""


def _parse_llm_floats(text: str) -> dict[str, float] | None:
    """Best-effort JSON-object extraction from LLM output."""
    if not text:
        return None
    # Find first {...} block
    match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        obj = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    out: dict[str, float] = {}
    for key in ("viral", "hook", "hold"):
        v = obj.get(key)
        if isinstance(v, (int, float)):
            out[key] = max(0.0, min(1.0, float(v)))
    if len(out) != 3:
        return None
    return out


async def _llm_critique(
    *,
    prompt: str | None,
    aspect: str | None,
    artifact_url: str | None,
) -> dict[str, float] | None:
    """Single-turn LLM critique. Returns None on any failure → caller falls back."""
    try:
        # Imported lazily so missing module / import errors trigger fallback
        # rather than 500'ing the whole router at import time.
        from agents.contract import (  # type: ignore[import-not-found]
            AdapterExecutionContext,
            AgentSpec,
            RuntimeState,
        )
        from agents.runtime import execute as agents_execute  # type: ignore[import-not-found]
    except Exception as exc:  # noqa: BLE001 — graceful fallback on any import error
        logger.info("LLM critique unavailable (import): %s", exc)
        return None

    instructions = "You score creative virality on three 0..1 axes. Respond with strict JSON."
    user_prompt = _CRITIQUE_PROMPT.format(
        prompt=(prompt or "(no prompt)").strip()[:600],
        url=(artifact_url or "(no url)"),
        aspect=(aspect or "(unspecified)"),
    )

    spec = AgentSpec(
        id="virality-critic",
        name="Virality Critic",
        role="critic",
        instructions=instructions,
        adapter_type=os.environ.get("DEFAULT_ADAPTER", "openai"),
    )
    ctx = AdapterExecutionContext(
        run_id=str(uuid.uuid4()),
        agent=spec,
        runtime=RuntimeState(),
        config={},
        context={"prompt": user_prompt},
    )

    try:
        result = await agents_execute(ctx)
    except NotImplementedError:
        logger.info("LLM critique unavailable: agents.runtime.execute is a stub")
        return None
    except Exception as exc:  # noqa: BLE001 — never fail the request on critique error
        logger.warning("LLM critique error: %s", exc)
        return None

    # Pull text from result_json.{output|text|content} — tolerant to adapter shapes
    payload = getattr(result, "result_json", None) or {}
    text: str | None = None
    for key in ("output", "text", "content", "message"):
        v = payload.get(key)
        if isinstance(v, str) and v.strip():
            text = v
            break
    if text is None:
        return None
    return _parse_llm_floats(text)


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------


def _to_score_result(
    *,
    heuristic: dict[str, Any],
    llm: dict[str, float] | None,
) -> tuple[ScoreResult, dict[str, Any]]:
    """Blend heuristic + llm halves; produce final ScoreResult + meta dict."""
    breakdown = heuristic["breakdown"]
    if llm is None:
        viral = heuristic["viralScore"]
        hook = heuristic["hookScore"]
        hold = heuristic["holdRate"]
        meta: dict[str, Any] = {"fallback": "heuristic-only"}
    else:
        viral = 0.5 * heuristic["viralScore"] + 0.5 * llm["viral"]
        hook = 0.5 * heuristic["hookScore"] + 0.5 * llm["hook"]
        hold = 0.5 * heuristic["holdRate"] + 0.5 * llm["hold"]
        meta = {"llm": llm, "heuristic": {
            "viralScore": heuristic["viralScore"],
            "hookScore": heuristic["hookScore"],
            "holdRate": heuristic["holdRate"],
        }}

    # Final viralScore is 0..100 int; hook/hold stay 0..1 floats per ScoreResult.
    viral_100 = int(round(max(0.0, min(1.0, viral)) * 100))

    result = ScoreResult(
        viralScore=viral_100,
        hookScore=round(max(0.0, min(1.0, hook)), 4),
        holdRate=round(max(0.0, min(1.0, hold)), 4),
        breakdown=ScoreBreakdown(
            aspect=breakdown["aspect"],
            motion=breakdown["motion"],
            hookDensity=breakdown["hookDensity"],
            contrast=breakdown["contrast"],
            novelty=breakdown["novelty"],
        ),
    )
    return result, meta


@router.post("")
async def score(req: ScoreRequest) -> dict[str, Any]:
    """Score an artifact for virality.

    Body accepts artifactId or artifactUrl plus optional prompt + aspect.
    Returns a ScoreResult-compatible JSON object plus a meta dict carrying
    the fallback flag and (when available) the raw heuristic + llm halves.
    """
    heuristic = _heuristic_score(
        prompt=req.prompt,
        aspect=req.aspect,
        artifact_url=req.artifact_url,
    )
    llm = await _llm_critique(
        prompt=req.prompt,
        aspect=req.aspect,
        artifact_url=req.artifact_url,
    )
    result, meta = _to_score_result(heuristic=heuristic, llm=llm)

    # by_alias=True so the camelCase contract from packages/shared-types is preserved.
    payload = result.model_dump(by_alias=True)
    payload["meta"] = meta
    if req.artifact_id:
        payload["artifactId"] = req.artifact_id
    return payload


__all__ = ["router", "_heuristic_score"]
