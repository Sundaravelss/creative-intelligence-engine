"""Research router — Tavily extract + search synthesizer.

POST /api/research with `{ url?, keyword? }` (at least one required).

When TAVILY_API_KEY is present:
- If a URL is provided, calls Tavily `extract` to pull page content.
- If a keyword is provided, calls Tavily `search` to gather context.
- Synthesizes the combined material into a Brief response.

When the key is missing OR the upstream call fails / times out, we fall back
to a deterministic fixture pulled from `fixtures/briefs/*.json`.

The Brief schema mirrors `packages/shared-types/index.ts` (Brief).
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from schemas import Brief

logger = logging.getLogger("cie.api.research")

router = APIRouter(prefix="/api/research", tags=["research"])

# Fixture directory: <repo-root>/fixtures/briefs
_REPO_ROOT = Path(__file__).resolve().parents[3]
_FIXTURE_DIR = _REPO_ROOT / "fixtures" / "briefs"

_TAVILY_TIMEOUT_S = 60.0
_FIXTURE_CACHE: list[Brief] | None = None


class ResearchRequest(BaseModel):
    """POST /api/research request body."""

    url: str | None = Field(default=None, description="Page URL to extract")
    keyword: str | None = Field(default=None, description="Keyword/topic to research")

    @model_validator(mode="after")
    def _at_least_one(self) -> "ResearchRequest":
        if not self.url and not self.keyword:
            raise ValueError("Provide at least one of `url` or `keyword`.")
        return self


def _load_fixture_briefs() -> list[Brief]:
    """Read every JSON file under fixtures/briefs into Brief models. Cached."""
    global _FIXTURE_CACHE
    if _FIXTURE_CACHE is not None:
        return _FIXTURE_CACHE

    briefs: list[Brief] = []
    if _FIXTURE_DIR.exists():
        for path in sorted(_FIXTURE_DIR.glob("*.json")):
            try:
                with path.open("r", encoding="utf-8") as fh:
                    briefs.append(Brief.model_validate(json.load(fh)))
            except (OSError, ValueError) as exc:
                logger.warning("Skipping malformed fixture %s: %s", path.name, exc)
    _FIXTURE_CACHE = briefs
    return briefs


def _fixture_for(seed: str) -> Brief:
    """Pick a deterministic fixture for a given seed (URL or keyword)."""
    fixtures = _load_fixture_briefs()
    if not fixtures:
        # Last-ditch fallback so the API never returns a 500 in dev.
        return Brief(
            url=None,
            keyword=seed,
            audience="General audience.",
            competitors=[],
            positioning=f"Default positioning for '{seed}'.",
            hooks=[
                f"Hook 1 for {seed}",
                f"Hook 2 for {seed}",
                f"Hook 3 for {seed}",
                f"Hook 4 for {seed}",
                f"Hook 5 for {seed}",
            ],
        )
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    idx = int.from_bytes(digest[:4], "big") % len(fixtures)
    return fixtures[idx]


def _summarize_extract(extract_results: list[dict[str, Any]]) -> str:
    """Concatenate raw_content snippets from Tavily extract into one blob."""
    chunks: list[str] = []
    for item in extract_results or []:
        content = item.get("raw_content") or item.get("content") or ""
        if content:
            chunks.append(str(content)[:1200])
    return "\n\n".join(chunks)


def _competitors_from_search(search_results: list[dict[str, Any]]) -> list[str]:
    """Heuristic: take hostnames from top search results as competitor signal."""
    out: list[str] = []
    for item in search_results or []:
        url = str(item.get("url", ""))
        if not url:
            continue
        host = url.split("/")[2] if "://" in url else url
        host = host.replace("www.", "")
        brand = host.split(".")[0].title()
        if brand and brand not in out:
            out.append(brand)
        if len(out) >= 6:
            break
    return out


def _hooks_from_search(search_results: list[dict[str, Any]], keyword: str | None) -> list[str]:
    """Pull title-like strings from search results as candidate hooks."""
    hooks: list[str] = []
    for item in search_results or []:
        title = str(item.get("title", "")).strip()
        if title and 12 <= len(title) <= 90:
            hooks.append(title)
        if len(hooks) >= 5:
            break
    while len(hooks) < 5:
        seed = keyword or "your brand"
        hooks.append(f"Why {seed} is the only choice in 2026")
    return hooks[:8]


async def _call_tavily(url: str | None, keyword: str | None, api_key: str) -> Brief:
    """Run Tavily extract + search in a worker thread, with a hard timeout."""
    from tavily import TavilyClient  # type: ignore[import-not-found]

    def _do_calls() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        client = TavilyClient(api_key=api_key)
        extract_results: list[dict[str, Any]] = []
        search_results: list[dict[str, Any]] = []
        if url:
            try:
                resp = client.extract(urls=[url])
                extract_results = list(resp.get("results", []) or [])
            except Exception as exc:  # noqa: BLE001 — log + fall through
                logger.warning("Tavily extract failed: %s", exc)
        if keyword:
            try:
                resp = client.search(query=keyword, max_results=6, search_depth="basic")
                search_results = list(resp.get("results", []) or [])
            except Exception as exc:  # noqa: BLE001
                logger.warning("Tavily search failed: %s", exc)
        return extract_results, search_results

    extract_results, search_results = await asyncio.wait_for(
        asyncio.to_thread(_do_calls), timeout=_TAVILY_TIMEOUT_S
    )

    extract_blob = _summarize_extract(extract_results)
    competitors = _competitors_from_search(search_results)
    hooks = _hooks_from_search(search_results, keyword)

    audience_seed = keyword or (url or "this product")
    audience = (
        f"Inferred audience for '{audience_seed}': digitally-native consumers "
        "engaged with the category and active on Instagram, TikTok, and YouTube."
    )
    positioning = (
        (extract_blob[:280] + "…") if extract_blob else f"Distinct, premium positioning for {audience_seed}."
    )

    return Brief(
        url=url,
        keyword=keyword,
        audience=audience,
        competitors=competitors,
        positioning=positioning,
        hooks=hooks,
    )


@router.post("", response_model=Brief)
async def research(req: ResearchRequest) -> Brief:
    """Synthesize a Brief from Tavily, falling back to fixtures on any failure."""
    seed = req.url or req.keyword or ""
    api_key = os.environ.get("TAVILY_API_KEY")

    if not api_key:
        logger.info("TAVILY_API_KEY missing — returning fixture brief for seed=%s", seed)
        return _fixture_for(seed)

    try:
        return await _call_tavily(req.url, req.keyword, api_key)
    except asyncio.TimeoutError:
        logger.warning("Tavily call timed out after %.0fs — returning fixture", _TAVILY_TIMEOUT_S)
        return _fixture_for(seed)
    except Exception as exc:  # noqa: BLE001 — never 500 on upstream failures
        logger.warning("Tavily call errored (%s) — returning fixture", exc)
        return _fixture_for(seed)


@router.get("/health")
async def research_health() -> dict[str, Any]:
    """Quick introspection — useful to check fixture availability + key presence."""
    return {
        "ok": True,
        "tavily_key_present": bool(os.environ.get("TAVILY_API_KEY")),
        "fixture_count": len(_load_fixture_briefs()),
    }


@router.get("")
async def research_get_not_allowed() -> dict[str, Any]:
    """Defensive 405 for callers that hit GET by mistake."""
    raise HTTPException(status_code=405, detail="Use POST /api/research")
