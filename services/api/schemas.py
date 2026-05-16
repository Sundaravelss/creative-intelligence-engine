"""Pydantic v2 mirrors of packages/shared-types/index.ts.

Keep these aligned. Field names use snake_case where Python conventional;
the ts_name comment marks the camelCase original.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

ArtifactKind = Literal["image", "video", "document", "code"]
ConnectorStatus = Literal["connected", "not-connected", "coming-soon"]
ConnectorCategory = Literal[
    "ad-platforms",
    "social",
    "analytics",
    "commerce",
    "research",
    "email-crm",
    "ai-backends",
]
CampaignFormat = Literal["reel", "square", "story", "banner", "carousel"]


class Artifact(BaseModel):
    id: str
    kind: ArtifactKind
    url: str | None = None
    name: str
    source: str | None = None
    created_at: str = Field(..., alias="createdAt")
    updated_at: str = Field(..., alias="updatedAt")
    meta: dict[str, Any] | None = None
    cost_usd: float | None = Field(None, alias="costUsd")

    model_config = {"populate_by_name": True}


class Connector(BaseModel):
    id: str
    name: str
    category: ConnectorCategory
    status: ConnectorStatus
    last_sync: str | None = Field(None, alias="lastSync")
    icon: str | None = None
    description: str | None = None

    model_config = {"populate_by_name": True}


class BrandProduct(BaseModel):
    id: str
    name: str
    sku: str | None = None


class BrandProfile(BaseModel):
    id: str
    name: str
    logo_url: str | None = Field(None, alias="logoUrl")
    palette: list[str] = Field(default_factory=list)
    voice: str | None = None
    products: list[BrandProduct] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class Brief(BaseModel):
    url: str | None = None
    keyword: str | None = None
    audience: str | None = None
    competitors: list[str] | None = None
    positioning: str | None = None
    hooks: list[str] = Field(default_factory=list)


class ScoreBreakdown(BaseModel):
    aspect: float
    motion: float
    hook_density: float = Field(..., alias="hookDensity")
    contrast: float
    novelty: float

    model_config = {"populate_by_name": True}


class ScoreResult(BaseModel):
    viral_score: float = Field(..., alias="viralScore")
    hook_score: float = Field(..., alias="hookScore")
    hold_rate: float = Field(..., alias="holdRate")
    breakdown: ScoreBreakdown

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# WS-C — generation router request body
# ---------------------------------------------------------------------------

GenerateKind = Literal["image", "video"]


class GenerateRequest(BaseModel):
    """Body schema for ``POST /api/generate``.

    ``model`` is a provider-prefixed id:
    - ``fal-ai/...`` routes to FAL queue.
    - ``openai/...`` routes to the OpenAI Images fallback (stills only).
    """

    kind: GenerateKind
    model: str
    params: dict[str, Any] = Field(default_factory=dict)
    references: list[str] = Field(default_factory=list)
