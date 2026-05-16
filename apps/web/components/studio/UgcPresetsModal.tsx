"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PresetItem {
  id: string;
  label: string;
  src: string;
}

interface UgcPresetsModalProps {
  onPick?: (preset: PresetItem) => void;
}

const FALLBACK_HUES = [12, 145, 240, 320, 60, 200];

export function UgcPresetsModal({ onPick }: UgcPresetsModalProps) {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<PresetItem[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/ugc-presets/presets.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PresetItem[]) => {
        if (!cancelled) setPresets(data);
      })
      .catch(() => {
        if (!cancelled) setPresets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-white"
      >
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
        UGC presets
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-black/10 bg-background p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">UGC presets</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:bg-black/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {presets.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onPick?.(p);
                    setOpen(false);
                  }}
                  className={cn(
                    "group flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-xl border border-black/5 p-3 text-left text-white shadow-md transition-transform hover:scale-[1.02]",
                  )}
                  style={{
                    background: p.src
                      ? `center/cover url(${p.src})`
                      : `linear-gradient(135deg, oklch(0.7 0.14 ${FALLBACK_HUES[idx % FALLBACK_HUES.length]}), oklch(0.45 0.16 ${FALLBACK_HUES[idx % FALLBACK_HUES.length]}))`,
                  }}
                >
                  <span className="text-[13px] font-semibold drop-shadow-md">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
