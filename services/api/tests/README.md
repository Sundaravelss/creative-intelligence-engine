# `services/api/tests/`

Pytest suite for the FastAPI gateway. All tests in this directory are unit-
or integration-level with no live network — Tavily, FAL, OpenAI, and the
internal agents runtime are mocked.

```bash
cd services/api
uv run pytest tests/ -v
```

## Manual real-network smoke for /api/brand/scan

The `/api/brand/scan` endpoint does a real Tavily extract + search + LLM voice
synthesis. The pytest suite mocks all of this; to verify against the real
network, run the smoke below.

Requires `TAVILY_API_KEY` and either `OPENAI_API_KEY` or `PIONEER_API_KEY`
(picks up `DEFAULT_ADAPTER` from env, defaults to `openai`).

```bash
export TAVILY_API_KEY=tvly-...
export OPENAI_API_KEY=sk-...

# Boot the API (from repo root)
cd services/api && uv run uvicorn main:app --reload --port 8100 &

# Run a scan
curl -N -X POST http://localhost:8100/api/brand/scan \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.allbirds.com"}'

# Expect 4 SSE events: fetching, parsing, extracting, complete

# Verify fixture overwritten matches what GET /api/brand returns
diff <(jq -S . fixtures/brand.json) <(curl -s http://localhost:8100/api/brand | jq -S .)
```

To force the plain-httpx fallback path (skip Tavily) for testing:

```bash
export BRAND_SCAN_FALLBACK=httpx
```

The complete event will then carry `meta.voice_fallback=true` because the
voice LLM pass is skipped on the fallback branch.
