"use client";

import { useMemo } from "react";

import {
  STORYBOARD_SHOT_KINDS,
  type StoryboardShot,
  type StoryboardShotKind,
} from "@/lib/canvas/types";
import { ShotCard } from "./ShotCard";

interface StoryboardGridProps {
  shots: ReadonlyArray<StoryboardShot>;
  onPromoteVariant: (shotId: string, variantId: string) => void;
  onRemix: (shotId: string) => void;
  onExport: (shotId: string) => void;
  onSelectVariant: (shotId: string, variantId: string) => void;
}

function buildSkeletonShot(kind: StoryboardShotKind): StoryboardShot {
  return { id: `pending-${kind}`, kind, variants: [], heroVariantId: null };
}

export function StoryboardGrid({
  shots,
  onPromoteVariant,
  onRemix,
  onExport,
  onSelectVariant,
}: StoryboardGridProps) {
  // Always render exactly 6 slots in deterministic order. Real shots replace
  // the placeholder skeleton when they arrive on the SSE stream.
  const slots = useMemo(() => {
    const byKind = new Map<StoryboardShotKind, StoryboardShot>();
    for (const shot of shots) byKind.set(shot.kind, shot);
    return STORYBOARD_SHOT_KINDS.map((kind) => byKind.get(kind) ?? buildSkeletonShot(kind));
  }, [shots]);

  return (
    <div
      role="grid"
      aria-label="Storyboard"
      className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-3"
    >
      {slots.map((shot) => (
        <ShotCard
          key={shot.id}
          shot={shot}
          onPromoteVariant={onPromoteVariant}
          onRemix={onRemix}
          onExport={onExport}
          onSelectVariant={onSelectVariant}
        />
      ))}
    </div>
  );
}

export default StoryboardGrid;
