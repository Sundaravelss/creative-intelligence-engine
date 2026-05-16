"""Backend mirror of `packages/model-registry/src/index.ts`.

Keep the two in sync. This module is consumed by the agents layer so the
Art Director / Marketing Director can look up provider + default params
for a given model id.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

ModelKind = Literal[
    "image",
    "image-edit",
    "video",
    "video-edit",
    "lipsync",
    "upscale",
    "audio",
]
ModelProvider = Literal["fal", "openai", "bedrock"]


@dataclass(frozen=True)
class ModelEntry:
    id: str
    name: str
    kind: ModelKind
    provider: ModelProvider
    input_mode: Literal["single", "dual", "multi"]
    params: dict[str, object] = field(default_factory=dict)
    multi_image_limit: int | None = None
    tags: tuple[str, ...] = ()


MODELS: tuple[ModelEntry, ...] = (
    ModelEntry(
        id="fal-ai/flux/schnell",
        name="Flux Schnell",
        kind="image",
        provider="fal",
        input_mode="single",
        params={"width": 1024, "height": 1024, "num_inference_steps": 4},
        tags=("fast", "default"),
    ),
    ModelEntry(
        id="fal-ai/flux/dev",
        name="Flux Dev",
        kind="image",
        provider="fal",
        input_mode="single",
        params={"width": 1024, "height": 1024, "num_inference_steps": 28},
        tags=("quality",),
    ),
    ModelEntry(
        id="fal-ai/nano-banana-2",
        name="Nano Banana 2 (Flash Im)",
        kind="image",
        provider="fal",
        input_mode="dual",
        multi_image_limit=6,
        params={"aspect_ratio": "9:16"},
        tags=("viral", "default-canvas"),
    ),
    ModelEntry(
        id="fal-ai/flux-kontext-edit",
        name="Flux Kontext Edit",
        kind="image-edit",
        provider="fal",
        input_mode="multi",
        multi_image_limit=14,
        params={},
        tags=("edit",),
    ),
    ModelEntry(
        id="openai/gpt-image-2",
        name="GPT Image 2",
        kind="image",
        provider="openai",
        input_mode="single",
        params={"size": "1024x1024", "quality": "high"},
        tags=("text", "fallback"),
    ),
    ModelEntry(
        id="fal-ai/sora-2",
        name="Sora 2",
        kind="video",
        provider="fal",
        input_mode="dual",
        params={"duration": 8, "aspect_ratio": "9:16"},
        tags=("cinema", "default-video"),
    ),
    ModelEntry(
        id="fal-ai/kling-video/v2",
        name="Kling Video 2",
        kind="video",
        provider="fal",
        input_mode="dual",
        params={"duration": 5, "aspect_ratio": "9:16"},
        tags=("motion",),
    ),
    ModelEntry(
        id="fal-ai/veo-3",
        name="Veo 3",
        kind="video",
        provider="fal",
        input_mode="dual",
        params={"duration": 8, "aspect_ratio": "16:9"},
        tags=("quality",),
    ),
    ModelEntry(
        id="fal-ai/seedance-2",
        name="Seedance 2.0",
        kind="video",
        provider="fal",
        input_mode="dual",
        params={"duration": 6, "aspect_ratio": "9:16"},
        tags=("fast",),
    ),
    ModelEntry(
        id="fal-ai/sync-lipsync",
        name="Sync Lipsync",
        kind="lipsync",
        provider="fal",
        input_mode="multi",
        multi_image_limit=2,
        params={},
        tags=("talking-head",),
    ),
    ModelEntry(
        id="fal-ai/topaz-upscale",
        name="Topaz Upscale",
        kind="upscale",
        provider="fal",
        input_mode="single",
        params={"scale": 2},
        tags=(),
    ),
)


def find_model(model_id: str) -> ModelEntry | None:
    return next((m for m in MODELS if m.id == model_id), None)


def models_by_kind(kind: ModelKind) -> tuple[ModelEntry, ...]:
    return tuple(m for m in MODELS if m.kind == kind)


def default_model_for(kind: ModelKind) -> ModelEntry | None:
    for tag in ("default-canvas", "default"):
        match = next((m for m in MODELS if m.kind == kind and tag in m.tags), None)
        if match is not None:
            return match
    return next((m for m in MODELS if m.kind == kind), None)


__all__ = [
    "ModelEntry",
    "ModelKind",
    "ModelProvider",
    "MODELS",
    "find_model",
    "models_by_kind",
    "default_model_for",
]
