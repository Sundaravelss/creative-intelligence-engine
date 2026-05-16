"use client";

import { useState, type ChangeEvent } from "react";
import { ImagePlus, X } from "lucide-react";

import type { MoodboardPin } from "@/lib/canvas/types";

interface MoodboardRailProps {
  pins: ReadonlyArray<MoodboardPin>;
  onAddPin: (pin: MoodboardPin) => void;
  onRemovePin: (pinId: string) => void;
}

function uid(): string {
  return `pin_${Math.random().toString(36).slice(2, 10)}`;
}

export function MoodboardRail({ pins, onAddPin, onRemovePin }: MoodboardRailProps) {
  const [urlDraft, setUrlDraft] = useState("");

  const handleSubmit = () => {
    const url = urlDraft.trim();
    if (!url) return;
    try {
      // basic URL sanity — reject anything that doesn't parse
      const parsed = new URL(url);
      onAddPin({ id: uid(), url: parsed.toString() });
      setUrlDraft("");
    } catch {
      // ignore malformed input; user can correct and retry
    }
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onAddPin({ id: uid(), url, label: file.name });
    e.target.value = "";
  };

  return (
    <section
      aria-label="Moodboard"
      className="flex flex-col gap-2 border-r border-[color:var(--color-border)] bg-[color:var(--hc-surface-recessed)]/40 p-3"
    >
      <header className="flex items-center justify-between">
        <h3 className="hc-serif-headline text-[13px] font-semibold tracking-tight">
          Moodboard
        </h3>
        <span className="text-[10px] text-[color:var(--color-muted-foreground)]">
          {pins.length} pin{pins.length === 1 ? "" : "s"}
        </span>
      </header>

      <p className="text-[11px] leading-snug text-[color:var(--color-muted-foreground)]">
        Drop reference images. Pins attach to every generation in this run.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {pins.map((pin) => (
          <div
            key={pin.id}
            className="hc-glass relative overflow-hidden rounded-md border border-white/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pin.url}
              alt={pin.label ?? "Moodboard pin"}
              className="aspect-square w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onRemovePin(pin.id)}
              aria-label="Remove pin"
              className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-1 space-y-2">
        <label
          className="hc-glass flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[color:var(--color-border)] bg-white/40 text-[12px] hover:bg-white/60"
        >
          <ImagePlus size={14} aria-hidden />
          <span>Upload</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </label>
        <div className="flex gap-1.5">
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Paste image URL"
            className="hc-glass min-w-0 flex-1 rounded-md border border-[color:var(--color-border)] bg-white/60 px-2 py-1.5 text-[11px] outline-none focus:border-[oklch(0.66_0.18_25_/_0.6)]"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!urlDraft.trim()}
            className="hc-glass rounded-md bg-[oklch(0.66_0.18_25_/_0.85)] px-2.5 text-[11px] font-medium text-white hover:bg-[oklch(0.66_0.18_25)] disabled:opacity-50"
          >
            Pin
          </button>
        </div>
      </div>
    </section>
  );
}

export default MoodboardRail;
