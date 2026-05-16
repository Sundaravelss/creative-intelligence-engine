"use client";

import { cn } from "@/lib/utils";
import type { Artifact } from "@cie/ui-artifacts";

interface ThumbnailStripProps {
  artifacts: Artifact[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

function thumbColor(idx: number): string {
  const hues = [12, 35, 95, 145, 200, 260, 320, 0, 70];
  return `oklch(0.7 0.14 ${hues[idx % hues.length]})`;
}

export function ThumbnailStrip({
  artifacts,
  activeId,
  onSelect,
}: ThumbnailStripProps) {
  if (artifacts.length === 0) return null;

  // Show up to 6 thumbs centered around active.
  const max = 6;
  const visible =
    artifacts.length <= max
      ? artifacts
      : artifacts.slice(0, max);

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/40 bg-white/55 p-2 shadow-lg backdrop-blur-md">
      {visible.map((a, idx) => {
        const isActive = a.id === activeId;
        const url = a.type === "image" ? a.url : undefined;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect(a.id)}
            aria-label={a.name}
            className="flex flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "h-12 w-12 overflow-hidden rounded-lg border border-white/60 shadow-sm transition-all",
                isActive
                  ? "ring-2 ring-[oklch(0.66_0.18_25)] ring-offset-1"
                  : "opacity-80 hover:opacity-100",
              )}
              style={{
                background: url
                  ? `center/cover url(${url})`
                  : `linear-gradient(135deg, ${thumbColor(idx)}, oklch(0.45 0.16 ${(idx * 47) % 360}))`,
              }}
            />
            <span
              className={cn(
                "h-1 w-1 rounded-full transition-colors",
                isActive
                  ? "bg-[oklch(0.66_0.18_25)]"
                  : "bg-transparent",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
