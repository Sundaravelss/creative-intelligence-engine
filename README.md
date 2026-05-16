# Creative Intelligence Engine (CIE)

Unified **agentic Marketing OS** for TechEurope Paris hackathon: ad-performance ingestion → top-performer analysis → multi-modal creative generation → publishing — built around a **node-based canvas + agent layer + recurring routines + connectors hub**.


## Stack

- **Frontend:** Next.js 14 App Router, React 19, Tailwind v4, React Flow, pnpm workspace
- **Backend:** FastAPI + uv workspace (`services/api`, `services/agents`, `services/scheduler`)
- **LLM:** Pioneer fine-tune (sponsor) primary, OpenAI fallback, Hermes/Claude Code optional
- **Image / Video:** FAL (sponsor credits)
- **Research:** Tavily

## Boot

```bash
# 1. Install JS deps (root of this folder)
pnpm install

# 2. Frontend (port 3000)
pnpm --filter web dev

# 3. Backend gateway (port 8100)
cd services/api && uv sync && uv run uvicorn main:app --reload --port 8100

# 4. Scheduler worker (no port)
cd services/scheduler && uv run python main.py
```

Routes: `/canvas`, `/studio`, `/loops`, `/connectors`, `/brand`, `/agents`.

## Plan

Full implementation plan with the 9-workstream graph (WS-0 through WS-H) lives at:
`/Users/u1060059/.claude/plans/i-am-building-new-rustling-dongarra.md`

## Layout

```
creative_intelligence_engine/
├── apps/
│   ├── web/           # Next.js 14 frontend
│   └── studio/        # Forked from Open-Generative-AI packages/studio (model registry)
├── packages/
│   ├── ui-artifacts/  # Ported from my_paperclip ui-features artifacts
│   ├── canvas-nodes/  # WS-B: React Flow node types
│   └── shared-types/  # Cross-cutting TS types (mirrored in services/api/schemas.py)
├── services/
│   ├── api/           # FastAPI gateway (8 routers)
│   ├── agents/        # Paperclip-style adapter pattern (Python)
│   └── scheduler/     # APScheduler worker
├── infra/             # docker-compose.yml
├── fixtures/          # Mock data (connectors, insights, briefs, posts)
├── browser-harness/   # symlink → ../browser-harness
└── research/          # symlink → ../research (computer-use captures)
```
