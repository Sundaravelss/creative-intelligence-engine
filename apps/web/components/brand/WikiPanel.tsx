"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

import { LogoUploader } from "./LogoUploader";
import { PaletteEditor } from "./PaletteEditor";
import type { ExtendedBrandProfile } from "./types";

interface WikiPanelProps {
  brand: ExtendedBrandProfile;
  onChange: (brand: ExtendedBrandProfile) => void;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function WikiPanel({ brand, onChange }: WikiPanelProps) {
  const [local, setLocal] = useState<ExtendedBrandProfile>(brand);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Keep local copy in sync when parent receives a freshly-scanned brand.
  useEffect(() => {
    setLocal(brand);
    setStatus("idle");
  }, [brand]);

  const update = (patch: Partial<ExtendedBrandProfile>): void => {
    setLocal((prev) => ({ ...prev, ...patch }));
    setStatus("idle");
  };

  const onSave = async (): Promise<void> => {
    setStatus("saving");
    setError(null);
    try {
      const saved = await api.put<ExtendedBrandProfile>("/api/brand", local);
      setLocal(saved);
      onChange(saved);
      setStatus("saved");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(message);
      setStatus("error");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      {/* Left column: identity */}
      <section className="flex flex-col gap-6 rounded-2xl border border-border/40 bg-background/60 p-6">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Identity
          </h3>
          <p className="mt-1 text-xs text-muted-foreground/80">
            How the brand presents itself.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="brand-name">
            Brand name
          </label>
          <input
            id="brand-name"
            value={local.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Allbirds"
            className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Logo</span>
          <LogoUploader
            logoUrl={local.logoUrl}
            onUploaded={(url) => update({ logoUrl: url })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="brand-tagline">
            Tagline
          </label>
          <input
            id="brand-tagline"
            value={local.tagline ?? ""}
            onChange={(e) => update({ tagline: e.target.value })}
            placeholder="Comfortable, sustainable shoes & apparel"
            className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Palette</span>
          <PaletteEditor
            palette={local.palette}
            onChange={(palette) => update({ palette })}
          />
        </div>

        <div className="flex flex-col gap-1 border-t border-border/40 pt-4 text-xs text-muted-foreground">
          <span>
            Source:{" "}
            {local.sourceUrl ? (
              <a
                href={local.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:underline"
              >
                {local.sourceUrl}
              </a>
            ) : (
              "—"
            )}
          </span>
          <span>Last scanned: {formatTimestamp(local.lastScannedAt)}</span>
        </div>
      </section>

      {/* Right column: voice */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-background/60 p-6">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Voice
          </h3>
          <p className="mt-1 text-xs text-muted-foreground/80">
            How the brand sounds when it speaks. Used as a system prompt by every downstream generation.
          </p>
        </div>

        <textarea
          value={local.voice ?? ""}
          onChange={(e) => update({ voice: e.target.value })}
          rows={12}
          placeholder="Calm, plain-spoken, sustainability-forward. Uses first-person plural. Short sentences. Avoids jargon and superlatives."
          className="flex-1 resize-none rounded-md border border-border/60 bg-background p-4 text-sm leading-relaxed outline-none focus:border-foreground/40"
        />

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {(local.voice ?? "").trim().split(/\s+/).filter(Boolean).length} words
          </div>
          <div className="flex items-center gap-3">
            {status === "saved" && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                <Check className="h-3 w-3" /> Saved
              </span>
            )}
            {status === "error" && error && (
              <span className="text-xs text-destructive">{error}</span>
            )}
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={status === "saving"}
              className={cn(
                "inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background",
                "hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {status === "saving" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving
                </>
              ) : (
                "Save brand"
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default WikiPanel;
