"""Creative Intelligence Engine — FastAPI gateway.

Boots a single app on :8100 with:
- /health (returns {"ok": true})
- 8 stub routers (generate, research, agents, publish, loops, score, connectors, brand)

Each router import is wrapped in try/except so that downstream workstreams
(WS-C through WS-G) can iterate on their routers in parallel without breaking
the main module's import. Missing routers log a warning at startup.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env from repo root (two levels up: services/api -> services -> repo root)
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(_REPO_ROOT, ".env"), override=False)

logger = logging.getLogger("cie.api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    logger.info("CIE API starting on port %s", os.environ.get("PORT", "8100"))
    yield
    logger.info("CIE API shutting down")


def _allowed_origins() -> list[str]:
    app_url = os.environ.get("APP_BASE_URL", "http://localhost:3000")
    return [app_url, "http://localhost:3000", "http://127.0.0.1:3000"]


app = FastAPI(
    title="Creative Intelligence Engine API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


# Mount the 8 routers. Import errors are non-fatal so workstreams can iterate
# on their respective routers in parallel without breaking the gateway.
_ROUTER_MODULES = [
    "generate",
    "research",
    "agents",
    "publish",
    "loops",
    "score",
    "connectors",
    "brand",
]

for _name in _ROUTER_MODULES:
    try:
        _module = __import__(f"routers.{_name}", fromlist=["router"])
        app.include_router(_module.router)
        logger.info("Mounted router: %s", _name)
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("Could not mount router %s: %s", _name, exc)
