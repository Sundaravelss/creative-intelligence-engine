---
name: cie-artifact-meta
description: ui-artifacts package Artifact union has no meta field; WS-V1 carries variant + score data via structural cast
metadata:
  type: project
---

`packages/ui-artifacts/types.ts` defines `Artifact` as a discriminated union with no `meta` field. `packages/shared-types/index.ts` defines a *different* `Artifact` interface that DOES have `meta`.

WS-V1 `LiquidCanvas` and `VariantStack` need to bucket variants by `shotId` and read `viralScore` per artifact. The studio page populates these via `(artifact as unknown as { meta: Record<string, unknown> }).meta = {...}` after pushing the artifact, and consumers read it back via the same structural cast.

**Why:** Avoiding a breaking change to the `@cie/ui-artifacts` discriminated union (which would force renderer rewrites) for what is effectively a runtime-only side channel.

**How to apply:** When you need to attach variant/score/etc to an artifact in the studio canvas, use the cast pattern. For long-term cleanup, migrate `ui-artifacts` Artifact union to share `meta` via a base interface.
