"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { api } from "@/lib/api";
import { API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

import { ProductList } from "./ProductList";
import type { ExtendedBrandProfile } from "./types";

interface UnitsPanelProps {
  brand: ExtendedBrandProfile;
  onChange: (brand: ExtendedBrandProfile) => void;
}

type RescanStatus = "idle" | "running" | "error";

export function UnitsPanel({ brand, onChange }: UnitsPanelProps) {
  const [status, setStatus] = useState<RescanStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const onRescan = async (): Promise<void> => {
    if (!brand.sourceUrl) {
      setError("No source URL on this brand — paste one in Sources first.");
      setStatus("error");
      return;
    }
    setStatus("running");
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/brand/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: brand.sourceUrl }),
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(`Re-scan failed (${res.status})`);
      }
      // Drain any SSE body without parsing — endpoint may stream.
      try {
        await res.text();
      } catch {
        // ignore
      }
      const fetched = await api.get<ExtendedBrandProfile>("/api/brand");
      onChange(fetched);
      setStatus("idle");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Re-scan failed";
      setError(message);
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Units
          </h3>
          <p className="mt-1 text-xs text-muted-foreground/80">
            Products carried in brand memory. Used as references in image and video generation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onRescan()}
          disabled={status === "running"}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-4 py-1.5 text-sm font-medium",
            "hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {status === "running" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Re-scanning
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" /> Re-scan products
            </>
          )}
        </button>
      </div>

      {status === "error" && error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-border/40 bg-background/60 p-6">
        <ProductList
          products={brand.products ?? []}
          onChange={(products) => onChange({ ...brand, products })}
        />
      </div>
    </div>
  );
}

export default UnitsPanel;
