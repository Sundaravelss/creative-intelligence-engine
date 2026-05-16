"use client";

import { useEffect, useState } from "react";

import type { BrandProfile } from "@cie/shared-types";

import { LogoUploader } from "../../../components/brand/LogoUploader";
import { PaletteEditor } from "../../../components/brand/PaletteEditor";
import { ProductList } from "../../../components/brand/ProductList";
import { ApiError, api } from "../../../lib/api";

const EMPTY_PROFILE: BrandProfile = {
  id: "new-brand",
  name: "",
  logoUrl: undefined,
  palette: ["#0F172A", "#F97316", "#FBBF24", "#FFFFFF"],
  voice: "",
  products: [],
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function BrandPage() {
  const [profile, setProfile] = useState<BrandProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetched = await api.get<BrandProfile>("/api/brand");
        if (!cancelled) setProfile(fetched);
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          // No brand saved yet — that's fine, fall back to defaults.
          setProfile(EMPTY_PROFILE);
        } else {
          const message = err instanceof Error ? err.message : "Failed to load brand";
          setLoadError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (patch: Partial<BrandProfile>): void => {
    setProfile((prev) => ({ ...prev, ...patch }));
    setSaveStatus("idle");
  };

  const onSave = async (): Promise<void> => {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const saved = await api.put<BrandProfile>("/api/brand", profile);
      setProfile(saved);
      setSaveStatus("saved");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Save failed";
      setSaveError(message);
      setSaveStatus("error");
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen p-10">
        <p className="text-muted-foreground">Loading brand profile…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl p-10">
      <header className="mb-8">
        <h1 className="hc-serif-headline text-3xl font-semibold">Brand Memory</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          The single source of truth for your brand: logo, palette, voice, and products.
          Used by every generation downstream.
        </p>
      </header>

      {loadError ? (
        <div className="border-destructive bg-destructive/5 text-destructive mb-6 rounded-md border p-3 text-sm">
          {loadError}
        </div>
      ) : null}

      <section className="hc-glass hc-card mb-6 flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <label htmlFor="brand-name" className="text-sm font-medium">
            Brand name
          </label>
          <input
            id="brand-name"
            value={profile.name}
            onChange={(e) => update({ name: e.target.value })}
            className="rounded border px-3 py-2"
            placeholder="Acme Sneakers"
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Logo</span>
          <LogoUploader
            logoUrl={profile.logoUrl}
            onUploaded={(url) => update({ logoUrl: url })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Palette</span>
          <PaletteEditor
            palette={profile.palette}
            onChange={(palette) => update({ palette })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="brand-voice" className="text-sm font-medium">
            Voice
          </label>
          <textarea
            id="brand-voice"
            value={profile.voice ?? ""}
            onChange={(e) => update({ voice: e.target.value })}
            rows={4}
            className="rounded border px-3 py-2"
            placeholder="Bold, irreverent, Gen-Z. Short sentences. Lots of attitude."
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Products</span>
          <ProductList
            products={profile.products}
            onChange={(products) => update({ products })}
          />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saveStatus === "saving"}
          className="bg-foreground text-background hc-pill rounded-full px-5 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saveStatus === "saving" ? "Saving…" : "Save brand"}
        </button>
        {saveStatus === "saved" ? (
          <span className="text-sm text-emerald-600">Saved</span>
        ) : null}
        {saveStatus === "error" && saveError ? (
          <span className="text-destructive text-sm">{saveError}</span>
        ) : null}
      </div>
    </main>
  );
}
