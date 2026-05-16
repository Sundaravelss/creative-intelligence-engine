"use client";

import { useMemo } from "react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  PRESETS,
  PRESET_CATEGORIES,
  type CanvasPreset,
  type PresetCategory,
} from "@/lib/canvas/presets";

interface PresetShelfProps {
  activePresetIds: ReadonlyArray<string>;
  onTogglePreset: (presetId: string) => void;
}

function resolveIcon(name: string | undefined): LucideIcon {
  if (!name) return LucideIcons.Sparkles;
  const candidate = (LucideIcons as Record<string, unknown>)[name];
  if (typeof candidate === "function" || typeof candidate === "object") {
    return candidate as LucideIcon;
  }
  return LucideIcons.Sparkles;
}

export function PresetShelf({ activePresetIds, onTogglePreset }: PresetShelfProps) {
  const grouped = useMemo(() => {
    const map = new Map<PresetCategory, CanvasPreset[]>();
    for (const cat of PRESET_CATEGORIES) map.set(cat.id, []);
    for (const preset of PRESETS) {
      const bucket = map.get(preset.category);
      if (bucket) bucket.push(preset);
    }
    return map;
  }, []);

  return (
    <section
      aria-label="Preset shelf"
      className="border-b border-[color:var(--color-border)] bg-[color:var(--hc-surface-recessed)]/60 backdrop-blur-md"
    >
      <div className="space-y-3 px-4 py-3">
        {PRESET_CATEGORIES.map((cat) => {
          const items = grouped.get(cat.id) ?? [];
          return (
            <div key={cat.id} className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <h3 className="hc-serif-headline text-[13px] font-semibold tracking-tight">
                  {cat.label}
                </h3>
                <span className="text-[11px] text-[color:var(--color-muted-foreground)]">
                  {cat.description}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {items.map((preset) => {
                  const Icon = resolveIcon(preset.icon);
                  const active = activePresetIds.includes(preset.id);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onTogglePreset(preset.id)}
                      aria-pressed={active}
                      title={preset.promptFragment}
                      className={[
                        "hc-glass shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
                        "text-[12px] transition-transform duration-150 active:scale-[0.97]",
                        active
                          ? "bg-[oklch(0.66_0.18_25_/_0.85)] text-white shadow-md"
                          : "bg-white/60 hover:bg-white/80 text-[color:var(--color-foreground)]",
                      ].join(" ")}
                    >
                      <Icon size={12} aria-hidden />
                      <span>{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default PresetShelf;
