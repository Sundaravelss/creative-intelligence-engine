"""OpenAI Images API adapter (stills-only fallback).

Used when callers prefix the model with ``openai/`` (e.g. ``openai/gpt-image-1``)
or when FAL is unavailable. Reads ``OPENAI_API_KEY`` from the environment.

We default to ``gpt-image-1``: it returns ``b64_json`` plus a ``url`` for the
Standard tier and is the current OpenAI-recommended image model. ``dall-e-3``
remains selectable but is no longer the default.

Logic adapted from ``ai-agency/scripts/generate_image.py`` (Azure variant);
we drop the Azure code path here -- it is the OpenAI public API only.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from dotenv import load_dotenv

load_dotenv(override=False)

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gpt-image-1"

# Rough USD-per-image pricing snapshot for the cost log.
# Quality keys mirror OpenAI's API values: low/medium/high/standard/hd.
_COST_TABLE: dict[tuple[str, str], float] = {
    ("1024x1024", "low"):       0.011,
    ("1024x1024", "medium"):    0.042,
    ("1024x1024", "high"):      0.167,
    ("1024x1024", "standard"):  0.040,
    ("1024x1024", "hd"):        0.080,
    ("1536x1024", "medium"):    0.063,
    ("1024x1536", "medium"):    0.063,
    ("1792x1024", "standard"):  0.080,
    ("1024x1792", "standard"):  0.080,
    ("1792x1024", "hd"):        0.120,
    ("1024x1792", "hd"):        0.120,
}


def estimate_cost(size: str, quality: str) -> float:
    """Look up rough USD cost for a single image at given size/quality."""
    return _COST_TABLE.get((size, quality), 0.0)


async def generate(
    prompt: str,
    size: str = "1024x1024",
    quality: str = "standard",
    model: str = DEFAULT_MODEL,
) -> dict[str, Any]:
    """Generate one image and return ``{"url", "b64_json", "cost_usd", "model", ...}``.

    Args:
        prompt:   The image generation prompt (validated as non-empty).
        size:     OpenAI-supported size string. Default ``"1024x1024"``.
        quality:  ``"low" | "medium" | "high" | "standard" | "hd"``. Default ``"standard"``.
        model:    OpenAI model id. Default :data:`DEFAULT_MODEL`.

    Returns:
        A dict with at least ``url`` (or ``b64_json`` if URL is unavailable),
        ``cost_usd``, ``model``, ``size``, ``quality`` and ``revised_prompt``
        (when present).

    Raises:
        ValueError: when prompt is empty.
        RuntimeError: when ``OPENAI_API_KEY`` is missing.
    """
    if not prompt or not prompt.strip():
        raise ValueError("prompt must be a non-empty string")

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    # Lazy import keeps the module importable in environments without openai
    # installed (and avoids paying the import cost when this fallback is unused).
    try:
        from openai import AsyncOpenAI  # type: ignore[import-not-found]
    except ImportError as exc:  # pragma: no cover - dependency guaranteed by pyproject
        raise RuntimeError("openai package is required for OpenAI image generation") from exc

    client = AsyncOpenAI(api_key=api_key)

    logger.info(
        "OpenAI image generate model=%s size=%s quality=%s prompt_len=%d",
        model, size, quality, len(prompt),
    )

    response = await client.images.generate(
        model=model,
        prompt=prompt,
        size=size,
        quality=quality,
        n=1,
    )

    if not response.data:
        raise RuntimeError("OpenAI images API returned no data")

    image = response.data[0]
    url = getattr(image, "url", None)
    b64 = getattr(image, "b64_json", None)
    revised_prompt = getattr(image, "revised_prompt", None)

    if not url and not b64:
        raise RuntimeError("OpenAI images API returned neither url nor b64_json")

    return {
        "url": url,
        "b64_json": b64,
        "cost_usd": estimate_cost(size, quality),
        "model": model,
        "size": size,
        "quality": quality,
        "revised_prompt": revised_prompt,
    }
