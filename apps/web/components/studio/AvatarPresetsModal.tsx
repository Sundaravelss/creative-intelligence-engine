"use client";

import { useEffect, useState } from "react";
import { Users, X } from "lucide-react";

interface PresetItem {
  id: string;
  label: string;
  src: string;
}

interface AvatarPresetsModalProps {
  onPick?: (preset: PresetItem) => void;
}

const FALLBACK_HUES = [12, 35, 95, 145, 200, 260, 320, 0, 70];

export function AvatarPresetsModal({ onPick }: AvatarPresetsModalProps) {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<PresetItem[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/avatar-presets/presets.json")
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
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        Avatars
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-black/10 bg-background p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Avatar presets</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:bg-black/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
              {presets.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onPick?.(p);
                    setOpen(false);
                  }}
                  className="group flex flex-col items-center gap-2"
                >
                  <span
                    className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-semibold text-white shadow-md transition-transform group-hover:scale-105"
                    style={{
                      background: p.src
                        ? `center/cover url(${p.src})`
                        : `linear-gradient(135deg, oklch(0.7 0.16 ${FALLBACK_HUES[idx % FALLBACK_HUES.length]}), oklch(0.45 0.18 ${FALLBACK_HUES[idx % FALLBACK_HUES.length]}))`,
                    }}
                  >
                    {p.label.charAt(0)}
                  </span>
                  <span className="text-[12px] font-medium text-foreground">
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
