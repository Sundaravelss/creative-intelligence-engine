"use client";

import { useEffect } from "react";
import { Crop, Download, X } from "lucide-react";

import type { ExportFormat } from "@/lib/canvas/types";

interface ExportDialogProps {
  open: boolean;
  imageUrl: string | null;
  /** Display label for the artifact (used in alt text + filename). */
  label: string;
  onClose: () => void;
}

const FORMATS: ReadonlyArray<{
  id: ExportFormat;
  label: string;
  ratio: string;
  hint: string;
}> = [
  { id: "9:16", label: "Vertical", ratio: "9 / 16", hint: "TikTok · Reels · Shorts" },
  { id: "1:1", label: "Square", ratio: "1 / 1", hint: "Feed · Carousel" },
  { id: "16:9", label: "Horizontal", ratio: "16 / 9", hint: "YouTube · Display" },
];

export function ExportDialog({ open, imageUrl, label, onClose }: ExportDialogProps) {
  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !imageUrl) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export formats"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="hc-glass relative max-w-3xl rounded-xl border border-white/40 bg-white/85 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close export dialog"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-black hover:bg-black/20"
        >
          <X size={14} />
        </button>

        <header className="mb-4">
          <h2 className="hc-serif-headline text-lg font-semibold">Export formats</h2>
          <p className="mt-0.5 text-[12px] text-[color:var(--color-muted-foreground)]">
            CSS-cropped previews for v1. Server-side re-render lands in v2.
          </p>
        </header>

        <div className="grid grid-cols-3 gap-3">
          {FORMATS.map((fmt) => (
            <div key={fmt.id} className="space-y-2">
              <div
                className="hc-glass overflow-hidden rounded-lg border border-white/40 bg-black"
                style={{ aspectRatio: fmt.ratio }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={`${label} — ${fmt.label}`}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-medium">
                    {fmt.id} · {fmt.label}
                  </div>
                  <div className="text-[10px] text-[color:var(--color-muted-foreground)]">
                    {fmt.hint}
                  </div>
                </div>
                <a
                  href={imageUrl}
                  download={`${label.replace(/\s+/g, "-")}-${fmt.id.replace(":", "x")}.png`}
                  className="hc-glass inline-flex items-center gap-1 rounded-md bg-[oklch(0.66_0.18_25_/_0.9)] px-2 py-1 text-[11px] font-medium text-white hover:bg-[oklch(0.66_0.18_25)]"
                >
                  <Download size={11} />
                  <span>Save</span>
                </a>
              </div>
            </div>
          ))}
        </div>

        <footer className="mt-4 flex items-center gap-1.5 text-[11px] text-[color:var(--color-muted-foreground)]">
          <Crop size={11} aria-hidden />
          <span>v1 fast path uses CSS object-fit. Video reformat coming soon.</span>
        </footer>
      </div>
    </div>
  );
}

export default ExportDialog;
