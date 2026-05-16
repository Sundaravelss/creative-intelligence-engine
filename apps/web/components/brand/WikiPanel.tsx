"use client";

import { useEffect, useState } from "react";
import { Check, FileText, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { api, API_BASE_URL } from "@/lib/api";
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
  const [brandMd, setBrandMd] = useState<string | null>(null);
  const [mdLoading, setMdLoading] = useState<boolean>(true);

  // Keep local copy in sync when parent receives a freshly-scanned brand.
  useEffect(() => {
    setLocal(brand);
    setStatus("idle");
  }, [brand]);

  // Load fixtures/brand.md whenever the brand changes (e.g. after a fresh scan).
  useEffect(() => {
    let cancelled = false;
    setMdLoading(true);
    fetch(`${API_BASE_URL}/api/brand/md`)
      .then(async (res) => (res.ok ? res.text() : null))
      .then((md) => {
        if (cancelled) return;
        setBrandMd(md && md.trim() ? md : null);
        setMdLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setBrandMd(null);
        setMdLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brand.lastScannedAt, brand.id]);

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

      {/* Right column: Brand.md viewer + editable voice */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-background/60 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Brand.md
            </h3>
            <p className="mt-1 text-xs text-muted-foreground/80">
              Synthesized briefing from your last scan. Used as system prompt by every downstream generation.
            </p>
          </div>
          {mdLoading && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading
            </span>
          )}
        </div>

        <article
          className="flex-1 overflow-y-auto rounded-md border border-border/60 bg-background p-5 text-sm leading-relaxed text-foreground"
        >
          {brandMd ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="mt-0 mb-3 text-2xl font-medium tracking-tight text-foreground">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mt-5 mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mt-4 mb-1 text-sm font-semibold text-foreground">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="mb-3 text-foreground">{children}</p>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="my-3 border-l-2 border-foreground/30 pl-3 font-light not-italic text-foreground/80">{children}</blockquote>
                ),
                ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
                ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
                li: ({ children }) => <li className="text-foreground">{children}</li>,
                code: ({ children }) => (
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground/90">{children}</code>
                ),
                table: ({ children }) => (
                  <table className="mb-3 w-full border-collapse text-left text-xs">{children}</table>
                ),
                th: ({ children }) => (
                  <th className="border-b border-border/60 px-2 py-1 text-left font-medium text-muted-foreground">{children}</th>
                ),
                td: ({ children }) => (
                  <td className="border-b border-border/30 px-2 py-1">{children}</td>
                ),
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-2 hover:text-foreground/80">{children}</a>
                ),
              }}
            >
              {brandMd}
            </ReactMarkdown>
          ) : !mdLoading ? (
            <p className="text-sm text-muted-foreground">
              No Brand.md yet — run a scan from the <strong>Sources</strong> tab to generate one.
            </p>
          ) : null}
        </article>

        <details className="rounded-md border border-border/40 bg-background/40 px-3 py-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Edit voice (overrides synthesized markdown)
          </summary>
          <textarea
            value={local.voice ?? ""}
            onChange={(e) => update({ voice: e.target.value })}
            rows={4}
            placeholder="Calm, plain-spoken, sustainability-forward. Uses first-person plural. Short sentences. Avoids jargon and superlatives."
            className="mt-2 w-full resize-none rounded-md border border-border/60 bg-background p-3 text-sm leading-relaxed outline-none focus:border-foreground/40"
          />
          <div className="mt-1 text-[10px] text-muted-foreground">
            {(local.voice ?? "").trim().split(/\s+/).filter(Boolean).length} words
          </div>
        </details>

        <div className="flex items-center justify-end gap-3">
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
      </section>
    </div>
  );
}

export default WikiPanel;
