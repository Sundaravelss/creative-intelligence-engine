"""Art Director node — picks references and image/video model parameters."""

from __future__ import annotations

import json
import os
from typing import Any

from ..contract import AdapterExecutionContext, AgentSpec, RuntimeState

INSTRUCTIONS = """You are an art director for paid social ads.
Given audience + hooks + format mix, output strict JSON:
{
  "references": ["<short visual reference description>", ...],
  "style_variants": ["<style label 1>", "<style label 2>", "<style label 3>"],
  "image_model": "<fal-ai model id>",
  "video_model": "<fal-ai model id>",
  "params": {
    "aspect_ratio": "9:16" | "1:1" | "16:9",
    "style": "<one-line style note>"
  }
}

Notes for style_variants:
- Pick exactly 3 short, brief-aware labels (2-4 words each) describing distinct
  treatments of the SAME shot. Tailor them to the product and audience —
  e.g. for a leather bag: "matte studio", "golden street", "rain glaze";
  for skincare: "clean flatlay", "macro dewdrop", "soft daylight";
  for food: "overhead market", "moody candlelit", "bright kitchen".
- Avoid generic stand-ins like "editorial / golden-hour / overcast" unless
  they genuinely fit the brief.

Return ONLY the JSON.
"""

_AGENT = AgentSpec(
    id="art_director",
    name="Art Director",
    role="art_director",
    instructions=INSTRUCTIONS,
    adapter_type="pioneer",
)


def _parse(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}


# Style modifiers used to fan a single shot out into N variants. The
# orchestrator parallelises generation across these so the user sees a
# side-by-side stack scored by Performance Analyst.
STYLE_VARIANTS: tuple[str, ...] = ("editorial", "golden-hour", "overcast")

# Whitelist of FAL image models the orchestrator is allowed to dispatch. The
# LLM occasionally hallucinates fake model ids ("dualSense", "midjourney-v8")
# and we MUST NOT let those reach FAL — they 404 the entire run. Any value
# outside this set is replaced with `FAL_DEFAULT_IMAGE_MODEL` or the safe
# default below.
_ALLOWED_IMAGE_MODELS: frozenset[str] = frozenset(
    {
        "fal-ai/flux/dev",
        "fal-ai/flux/schnell",
        "fal-ai/flux-pro",
        "fal-ai/nano-banana",
    }
)
_ALLOWED_VIDEO_MODELS: frozenset[str] = frozenset(
    {
        "fal-ai/sora-2",
        "fal-ai/kling-video/v2/master",
        "fal-ai/veo3",
    }
)

# Camera-angle slots used when ``brief.mode == "storyboard"``. Mirrors the
# six slots rendered by `apps/web/components/canvas/storyboard/StoryboardGrid`.
STORYBOARD_SHOT_KINDS: tuple[str, ...] = (
    "wide",
    "close",
    "side",
    "overhead",
    "tracking",
    "static",
)

# Prompt modifiers per camera angle. These are appended to the base
# reference so the underlying image model produces the right framing.
_SHOT_KIND_PROMPTS: dict[str, str] = {
    "wide": "wide establishing shot, full body in frame, environmental context",
    "close": "tight close-up, shallow depth of field, expressive detail",
    "side": "side profile angle, parallel-to-subject framing",
    "overhead": "overhead bird's-eye view, top-down composition",
    "tracking": "low-angle tracking shot, subject in motion, kinetic blur",
    "static": "static locked-off frame, symmetrical composition",
}


def _variant_count() -> int:
    raw = os.environ.get("VARIANTS_PER_SHOT", "3")
    try:
        n = int(raw)
    except ValueError:
        return 3
    return max(1, min(n, len(STYLE_VARIANTS)))


def _resolve_style_labels(
    parsed_labels: list[str] | None, variant_count: int
) -> tuple[str, ...]:
    """Pick the variant labels, preferring the LLM output, falling back to
    the static tuple. Always returns exactly ``variant_count`` labels.
    """
    cleaned: list[str] = []
    if parsed_labels:
        for raw in parsed_labels:
            if not isinstance(raw, str):
                continue
            text = raw.strip()
            if text:
                cleaned.append(text)
    while len(cleaned) < variant_count:
        cleaned.append(STYLE_VARIANTS[len(cleaned) % len(STYLE_VARIANTS)])
    return tuple(cleaned[:variant_count])


def _expand_variants(
    references: list[str],
    keyword: str,
    variant_count: int,
    style_labels: tuple[str, ...],
) -> list[dict[str, Any]]:
    """Expand each reference into ``variant_count`` style variants.

    Returns a flat list of dicts shaped:
      {shot_id, shot_kind, variant_id, variant_label, prompt}
    """

    expanded: list[dict[str, Any]] = []
    for shot_idx, ref in enumerate(references):
        shot_id = f"shot_{shot_idx + 1}"
        for variant_idx in range(variant_count):
            style = style_labels[variant_idx % len(style_labels)]
            expanded.append(
                {
                    "shot_id": shot_id,
                    "shot_kind": "wide",
                    "variant_id": f"{shot_id}-v{variant_idx}",
                    "variant_label": style,
                    "prompt": f"{ref} of {keyword}, {style} style",
                }
            )
    return expanded


def _expand_storyboard(
    keyword: str, variant_count: int, style_labels: tuple[str, ...]
) -> list[dict[str, Any]]:
    """Fan a single brief into 6 camera-angle shots × N style variants.

    Used when the brief carries ``mode == "storyboard"``. The resulting
    list keeps the same shape as ``_expand_variants`` so downstream code
    (orchestrator, generation adapters) needs no special-case branch.
    """

    expanded: list[dict[str, Any]] = []
    for shot_kind in STORYBOARD_SHOT_KINDS:
        shot_id = f"shot_{shot_kind}"
        framing = _SHOT_KIND_PROMPTS[shot_kind]
        for variant_idx in range(variant_count):
            style = style_labels[variant_idx % len(style_labels)]
            expanded.append(
                {
                    "shot_id": shot_id,
                    "shot_kind": shot_kind,
                    "variant_id": f"{shot_id}-v{variant_idx}",
                    "variant_label": style,
                    "prompt": f"{keyword}, {framing}, {style} style",
                }
            )
    return expanded


async def forward(state: dict[str, Any], runtime: Any) -> dict[str, Any]:
    payload = {
        "audience": state.get("audience"),
        "hooks": state.get("hooks", []),
        "format_mix": state.get("format_mix", []),
        "brand": state.get("brand", {}),
    }
    ctx = AdapterExecutionContext(
        run_id=str(state.get("run_id", "run")),
        agent=_AGENT,
        runtime=RuntimeState(),
        config=state.get("adapter_config", {}),
        context={"prompt": json.dumps(payload, ensure_ascii=False)},
        on_log=state.get("on_log"),
    )
    result = await runtime.execute(ctx)
    parsed = _parse((result.result_json or {}).get("text", ""))
    references = parsed.get("references") or [
        f"hero shot of {state.get('brief', {}).get('keyword', 'product')}"
    ]
    brief = state.get("brief", {}) or {}
    keyword = brief.get("keyword", "product")
    mode = brief.get("mode")
    variant_count = _variant_count()
    style_labels = _resolve_style_labels(
        parsed.get("style_variants"), variant_count
    )
    if mode == "storyboard":
        variants = _expand_storyboard(keyword, variant_count, style_labels)
    else:
        variants = _expand_variants(references, keyword, variant_count, style_labels)
    parsed_image = parsed.get("image_model")
    image_model = (
        parsed_image
        if parsed_image in _ALLOWED_IMAGE_MODELS
        else os.environ.get("FAL_DEFAULT_IMAGE_MODEL", "fal-ai/flux/dev")
    )
    if image_model not in _ALLOWED_IMAGE_MODELS:
        image_model = "fal-ai/flux/dev"
    parsed_video = parsed.get("video_model")
    video_model = (
        parsed_video
        if parsed_video in _ALLOWED_VIDEO_MODELS
        else os.environ.get("FAL_DEFAULT_VIDEO_MODEL", "fal-ai/sora-2")
    )
    if video_model not in _ALLOWED_VIDEO_MODELS:
        video_model = "fal-ai/sora-2"
    return {
        **state,
        "references": references,
        "style_variants": list(style_labels),
        "image_model": image_model,
        "video_model": video_model,
        "art_params": parsed.get("params") or {"aspect_ratio": "9:16", "style": "clean editorial"},
        "variants": variants,
    }


__all__ = [
    "INSTRUCTIONS",
    "STYLE_VARIANTS",
    "STORYBOARD_SHOT_KINDS",
    "_resolve_style_labels",
    "forward",
]
