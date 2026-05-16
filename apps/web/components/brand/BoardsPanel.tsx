"use client";

import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ExtendedBrandProfile } from "./types";

interface BoardsPanelProps {
  brand: ExtendedBrandProfile;
  onJumpToSources: () => void;
}

interface BoardSpec {
  id: string;
  title: string;
  subtitle: string;
  // Indices into the palette array (cycled if out of range).
  gradientStops: [number, number, number];
}

const BOARDS: BoardSpec[] = [
  {
    id: "editorial",
    title: "Editorial",
    subtitle: "Lifestyle · magazine spreads",
    gradientStops: [0, 2, 1],
  },
  {
    id: "studio",
    title: "Studio",
    subtitle: "Hero shots · clean backdrops",
    gradientStops: [3, 1, 0],
  },
  {
    id: "ugc",
    title: "UGC",
    subtitle: "Authentic · in the wild",
    gradientStops: [2, 0, 3],
  },
  {
    id: "campaign",
    title: "Campaign",
    subtitle: "Bold · seasonal hero",
    gradientStops: [1, 3, 2],
  },
];

function pick(palette: string[], idx: number, fallback: string): string {
  if (palette.length === 0) return fallback;
  return palette[idx % palette.length] ?? fallback;
}

export function BoardsPanel({ brand, onJumpToSources }: BoardsPanelProps) {
  const palette = brand.palette ?? [];

  if (palette.filter(Boolean).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 px-6 py-16 text-center">
        <p className="text-sm font-medium">No palette yet</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Run a scan to extract brand colors before generating moodboards.
        </p>
        <button
          type="button"
          onClick={onJumpToSources}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:bg-foreground/90"
        >
          Go to Sources <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {BOARDS.map((board) => {
        const [a, b, c] = board.gradientStops;
        const c1 = pick(palette, a, "#1f2937");
        const c2 = pick(palette, b, "#9ca3af");
        const c3 = pick(palette, c, "#f3f4f6");
        return (
          <article
            key={board.id}
            className={cn(
              "group relative aspect-[4/5] overflow-hidden rounded-2xl border border-border/40",
              "shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl",
            )}
            style={{
              backgroundImage: `linear-gradient(135deg, ${c1} 0%, ${c2} 55%, ${c3} 100%)`,
            }}
          >
            {/* Soft inner highlight to feel like a moodboard, not a flat block */}
            <div
              className="absolute inset-0 opacity-60 mix-blend-overlay"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.35), transparent 55%)",
              }}
            />

            {/* Title overlay (top-left) */}
            <div className="absolute left-5 top-5 max-w-[80%]">
              <p className="text-xs font-medium uppercase tracking-wider text-white/70 mix-blend-difference">
                {board.title}
              </p>
              <p className="mt-1 text-sm font-medium text-white/90 mix-blend-difference">
                {board.subtitle}
              </p>
            </div>

            {/* Palette swatches (bottom-left) */}
            <div className="absolute bottom-4 left-4 flex items-center gap-1.5">
              {palette.slice(0, 4).map((hex, i) => (
                <span
                  key={`${board.id}-sw-${i}`}
                  aria-label={`Swatch ${hex}`}
                  className="h-5 w-5 rounded-full border border-white/60 shadow-sm"
                  style={{ background: hex }}
                />
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default BoardsPanel;
