"use client";

import { Clapperboard, Crop, RefreshCcw } from "lucide-react";

import { ScoreChip } from "@/components/canvas/ScoreChip";
import type { StoryboardShot, ShotVariant } from "@/lib/canvas/types";

const SHOT_LABEL: Record<StoryboardShot["kind"], string> = {
  wide: "Wide",
  close: "Close-up",
  side: "Side angle",
  overhead: "Overhead",
  tracking: "Tracking",
  static: "Static",
};

interface ShotCardProps {
  shot: StoryboardShot;
  onPromoteVariant: (shotId: string, variantId: string) => void;
  onRemix: (shotId: string) => void;
  onExport: (shotId: string) => void;
  onSelectVariant: (shotId: string, variantId: string) => void;
}

function findHero(shot: StoryboardShot): ShotVariant | null {
  if (!shot.variants.length) return null;
  if (shot.heroVariantId) {
    const explicit = shot.variants.find((v) => v.id === shot.heroVariantId);
    if (explicit) return explicit;
  }
  return shot.variants[0];
}

export function ShotCard({
  shot,
  onPromoteVariant,
  onRemix,
  onExport,
  onSelectVariant,
}: ShotCardProps) {
  const hero = findHero(shot);
  const altVariants = shot.variants.filter((v) => v.id !== hero?.id).slice(0, 2);
  const isEmpty = shot.variants.length === 0;

  return (
    <article
      className={[
        "hc-glass group relative flex flex-col overflow-hidden rounded-lg border border-white/40 bg-white/55 transition-shadow",
        isEmpty ? "border-dashed" : "hover:shadow-lg",
      ].join(" ")}
      aria-label={`Shot — ${SHOT_LABEL[shot.kind]}`}
    >
      <header className="flex items-center justify-between border-b border-white/40 bg-white/40 px-2.5 py-1.5">
        <div className="flex items-center gap-1.5">
          <Clapperboard size={12} className="text-[color:var(--color-muted-foreground)]" />
          <span className="text-[11px] font-medium tracking-tight">
            {SHOT_LABEL[shot.kind]}
          </span>
        </div>
        {hero?.viralScore !== undefined ? <ScoreChip score={hero.viralScore} size="sm" /> : null}
      </header>

      <div className="relative aspect-[9/12] w-full bg-[color:var(--hc-surface-recessed)]">
        {hero ? (
          <button
            type="button"
            onClick={() => onSelectVariant(shot.id, hero.id)}
            className="block h-full w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hero.url}
              alt={`${SHOT_LABEL[shot.kind]} — ${hero.label}`}
              className="h-full w-full object-cover"
            />
          </button>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center">
            <Clapperboard size={20} className="text-[color:var(--color-muted-foreground)]" />
            <span className="text-[11px] text-[color:var(--color-muted-foreground)]">
              {SHOT_LABEL[shot.kind]} (waiting…)
            </span>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between gap-1 border-t border-white/40 bg-white/40 px-2 py-1.5">
        <div className="flex gap-1">
          {altVariants.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onPromoteVariant(shot.id, v.id)}
              title={`Promote ${v.label}`}
              className="hc-glass relative h-8 w-8 overflow-hidden rounded-md border border-white/50 hover:scale-105"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.url} alt={v.label} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onRemix(shot.id)}
            disabled={isEmpty}
            aria-label="Remix shot"
            title="Generate fresh variants"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--color-foreground)] hover:bg-white/60 disabled:opacity-40"
          >
            <RefreshCcw size={12} />
          </button>
          <button
            type="button"
            onClick={() => onExport(shot.id)}
            disabled={isEmpty}
            aria-label="Export formats"
            title="Export 9:16 / 1:1 / 16:9"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--color-foreground)] hover:bg-white/60 disabled:opacity-40"
          >
            <Crop size={12} />
          </button>
        </div>
      </footer>
    </article>
  );
}

export default ShotCard;
