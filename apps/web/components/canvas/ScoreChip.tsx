"use client";

/**
 * ScoreChip — overlay chip rendered on top of artifact cards / canvas nodes.
 * Color-graded by score so a glance tells you whether the creative is hot.
 *
 * Companion to ScoreBreakdownPanel; this is a reusable overlay, NOT the
 * canvas node itself (WS-B owns nodes/ScoreNode.tsx).
 */

import { Rocket } from "lucide-react";
import type { CSSProperties, MouseEvent } from "react";

export type ScoreChipSize = "sm" | "md";

export interface ScoreChipProps {
  /** Virality score, expected range 0..100. Values outside the range are clamped. */
  score: number;
  size?: ScoreChipSize;
  onClick?: () => void;
  /** Optional className appended after the built-in classes. */
  className?: string;
}

interface ChipPalette {
  background: string;
  foreground: string;
  ring: string;
}

function paletteForScore(score: number): ChipPalette {
  if (score < 40) {
    // red — DOA
    return {
      background: "oklch(0.62 0.22 27 / 0.85)",
      foreground: "oklch(0.99 0 0)",
      ring: "oklch(0.62 0.22 27 / 0.5)",
    };
  }
  if (score < 60) {
    // orange — meh
    return {
      background: "oklch(0.72 0.18 55 / 0.85)",
      foreground: "oklch(0.14 0 0)",
      ring: "oklch(0.72 0.18 55 / 0.5)",
    };
  }
  if (score < 80) {
    // yellow — promising
    return {
      background: "oklch(0.85 0.16 95 / 0.85)",
      foreground: "oklch(0.14 0 0)",
      ring: "oklch(0.85 0.16 95 / 0.5)",
    };
  }
  // green — banger
  return {
    background: "oklch(0.68 0.18 145 / 0.88)",
    foreground: "oklch(0.99 0 0)",
    ring: "oklch(0.68 0.18 145 / 0.5)",
  };
}

const SIZE_CLASSES: Record<ScoreChipSize, string> = {
  sm: "h-6 px-2 text-[11px] gap-1",
  md: "h-8 px-3 text-sm gap-1.5",
};

const ICON_PX: Record<ScoreChipSize, number> = {
  sm: 12,
  md: 14,
};

export function ScoreChip({ score, size = "md", onClick, className }: ScoreChipProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const palette = paletteForScore(clamped);

  const style: CSSProperties = {
    background: palette.background,
    color: palette.foreground,
    boxShadow: `0 0 0 1px ${palette.ring}, 0 6px 18px oklch(0.14 0 0 / 0.18)`,
  };

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onClick?.();
  };

  const isInteractive = typeof onClick === "function";
  const baseClass = [
    "hc-glass",
    "inline-flex items-center justify-center rounded-full font-medium select-none",
    "backdrop-blur-md transition-transform duration-150",
    SIZE_CLASSES[size],
    isInteractive ? "cursor-pointer hover:scale-[1.04] active:scale-[0.98]" : "cursor-default",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      aria-label={`Virality score ${clamped}`}
      title={`Virality score ${clamped}/100`}
      onClick={handleClick}
      disabled={!isInteractive}
      className={baseClass}
      style={style}
    >
      <Rocket size={ICON_PX[size]} aria-hidden />
      <span>{clamped}</span>
    </button>
  );
}

export default ScoreChip;
