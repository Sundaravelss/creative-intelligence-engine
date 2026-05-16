"use client";

import { Columns3, Grid2x2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export type CanvasViewMode = "carousel" | "grid" | "stack";

interface ViewModeToggleProps {
  value: CanvasViewMode;
  onChange: (mode: CanvasViewMode) => void;
}

const OPTS: Array<{ id: CanvasViewMode; icon: typeof Columns3; label: string }> = [
  { id: "carousel", icon: Columns3, label: "Carousel" },
  { id: "grid", icon: Grid2x2, label: "Grid" },
  { id: "stack", icon: Layers, label: "Stack" },
];

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="View mode toggle"
      className="inline-flex items-center gap-0.5 rounded-full border border-white/40 bg-white/60 p-1 shadow-md backdrop-blur-md"
    >
      {OPTS.map(({ id, icon: Icon, label }) => {
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={label}
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex h-7 w-9 items-center justify-center rounded-full text-muted-foreground transition-all",
              active &&
                "bg-white text-[oklch(0.66_0.18_25)] shadow-sm ring-1 ring-black/5",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
