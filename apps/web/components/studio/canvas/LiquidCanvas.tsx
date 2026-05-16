"use client";

import { useMemo } from "react";
import type { Artifact } from "@cie/ui-artifacts";
import { ViewModeToggle, type CanvasViewMode } from "./ViewModeToggle";
import { ThumbnailStrip } from "./ThumbnailStrip";
import { VariantStack } from "./VariantStack";

interface LiquidCanvasProps {
  artifacts: Artifact[];
  viewMode: CanvasViewMode;
  setViewMode: (mode: CanvasViewMode) => void;
  focusId: string | null;
  setFocusId: (id: string) => void;
  selectedVariantByShot: Record<string, string>;
  onSelectVariant: (shotId: string, variantId: string) => void;
}

interface ShotGroup {
  shotId: string;
  variants: Artifact[];
}

function groupByShot(artifacts: Artifact[]): ShotGroup[] {
  const order: string[] = [];
  const map = new Map<string, Artifact[]>();
  for (const a of artifacts) {
    const variantOf = (a as unknown as { meta?: { variantOf?: string } }).meta
      ?.variantOf;
    const shotId = variantOf ?? a.id;
    if (!map.has(shotId)) {
      map.set(shotId, []);
      order.push(shotId);
    }
    map.get(shotId)!.push(a);
  }
  return order.map((shotId) => ({ shotId, variants: map.get(shotId)! }));
}

const NOISE_SVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`;

export function LiquidCanvas({
  artifacts,
  viewMode,
  setViewMode,
  focusId,
  setFocusId,
  selectedVariantByShot,
  onSelectVariant,
}: LiquidCanvasProps) {
  const groups = useMemo(() => groupByShot(artifacts), [artifacts]);
  const activeId = focusId ?? artifacts[0]?.id ?? null;

  return (
    <section className="relative flex h-full flex-col overflow-hidden">
      {/* gradient + noise */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(135deg, #dcd2e6 0%, #e8dde0 50%, #e7d6c5 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.04]"
        style={{ backgroundImage: `url("${NOISE_SVG}")` }}
      />

      {/* top-center toggle */}
      <div className="pointer-events-none absolute left-1/2 top-10 z-20 -translate-x-1/2">
        <div className="pointer-events-auto">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* main carousel/grid */}
      <div className="flex-1 overflow-auto px-6 pt-28 pb-32">
        {groups.length === 0 ? (
          <EmptyCanvas />
        ) : viewMode === "grid" ? (
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 sm:grid-cols-3">
            {artifacts.map((a) => (
              <VariantStack
                key={a.id}
                shotId={a.id}
                variants={[a]}
                selectedId={activeId}
                onSelect={(id) => setFocusId(id)}
                viewMode="grid"
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex items-center gap-8 overflow-x-auto px-12">
              {groups.map((g) => (
                <VariantStack
                  key={g.shotId}
                  shotId={g.shotId}
                  variants={g.variants}
                  selectedId={
                    selectedVariantByShot[g.shotId] ?? g.variants[0]?.id ?? null
                  }
                  onSelect={(id) => {
                    onSelectVariant(g.shotId, id);
                    setFocusId(id);
                  }}
                  viewMode={viewMode}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* bottom-center thumbnail strip */}
      {artifacts.length > 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 z-20 flex justify-center">
          <div className="pointer-events-auto">
            <ThumbnailStrip
              artifacts={artifacts}
              activeId={activeId}
              onSelect={setFocusId}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EmptyCanvas() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md text-center">
        <p className="text-[12px] uppercase tracking-[0.2em] text-muted-foreground">
          Live canvas
        </p>
        <h2 className="mt-2 font-serif text-2xl text-foreground">
          Your generations will appear here
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Send a brief from the chat — variants stream in as the agents work.
        </p>
      </div>
    </div>
  );
}
