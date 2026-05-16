"use client";

import { Canvas } from "../../../components/canvas/Canvas";
import { NodePalette } from "../../../components/canvas/NodePalette";

/**
 * /canvas — three-column workspace.
 *
 *  ┌────────────┬──────────────────────────────┬────────────────┐
 *  │  Palette   │   React Flow surface         │   Inspector    │
 *  │  (240 px)  │   (1fr — fluid)              │   (320 px)     │
 *  └────────────┴──────────────────────────────┴────────────────┘
 *
 * The right inspector is a placeholder until later workstreams wire
 * per-node forms. It is intentionally empty rather than mocked, so
 * we don't ship visual debt that needs to be undone.
 */
export default function CanvasPage() {
  return (
    <main
      className="grid h-screen w-full overflow-hidden"
      style={{ gridTemplateColumns: "240px 1fr 320px" }}
    >
      <NodePalette />

      <section className="relative overflow-hidden bg-[color:var(--hc-surface-recessed)]">
        <Canvas />
      </section>

      <aside
        className="hc-glass border-l border-[color:var(--color-border)] overflow-y-auto"
        aria-label="Inspector"
      >
        <div className="px-4 py-4">
          <h2 className="hc-serif-headline text-lg font-semibold">Inspector</h2>
          <p className="mt-1 text-[12px] text-[color:var(--color-muted-foreground)]">
            Select a node to edit its properties.
          </p>
          <div className="mt-6 rounded-lg border border-dashed border-[color:var(--color-border)] p-4 text-[12px] text-[color:var(--color-muted-foreground)]">
            Per-node forms land in a later workstream. For now the canvas
            persists to <code className="hc-pill px-1.5 py-0.5 bg-[color:var(--hc-surface-recessed)]">localStorage</code>;
            reload the page to verify.
          </div>
        </div>
      </aside>
    </main>
  );
}
