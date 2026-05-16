"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ApiError, api } from "@/lib/api";

import { BrandMemoryTabs, type BrandTabId } from "@/components/brand/BrandMemoryTabs";
import { isBrandEmpty, type ExtendedBrandProfile } from "@/components/brand/types";

const EMPTY_PROFILE: ExtendedBrandProfile = {
  id: "new-brand",
  name: "",
  logoUrl: undefined,
  palette: ["#0F172A", "#F97316", "#FBBF24", "#FFFFFF"],
  voice: "",
  products: [],
};

const VALID_TABS: readonly BrandTabId[] = ["boards", "sources", "wiki", "graph", "units"];

function isValidTab(value: string | null | undefined): value is BrandTabId {
  return !!value && (VALID_TABS as readonly string[]).includes(value);
}

function BrandPageInner() {
  const searchParams = useSearchParams();
  const queryTab = searchParams.get("tab");
  const [brand, setBrand] = useState<ExtendedBrandProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BrandTabId>(
    isValidTab(queryTab) ? queryTab : "sources",
  );

  // React to deep-links like /brand?tab=wiki even if the URL changes after mount.
  useEffect(() => {
    if (isValidTab(queryTab) && queryTab !== activeTab) {
      setActiveTab(queryTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryTab]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetched = await api.get<ExtendedBrandProfile>("/api/brand");
        if (cancelled) return;
        setBrand(fetched);
        // Honor the query-param choice; otherwise pick a sensible default.
        if (!isValidTab(queryTab)) {
          setActiveTab(isBrandEmpty(fetched) ? "sources" : "boards");
        }
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setBrand(EMPTY_PROFILE);
          if (!isValidTab(queryTab)) setActiveTab("sources");
        } else {
          const message = err instanceof Error ? err.message : "Failed to load brand";
          setLoadError(message);
          if (!isValidTab(queryTab)) setActiveTab("sources");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtitle = (() => {
    const parts: string[] = [];
    parts.push(brand.name && brand.name.trim().length > 0 ? brand.name : "No brand connected");
    parts.push(brand.sourceUrl ?? "—");
    return parts.join(" · ");
  })();

  return (
    <div className="flex h-full min-h-screen flex-col">
      <header className="border-b border-border/40 px-8 py-6">
        <div className="flex items-baseline justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Brand Memory</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {brand.lastScannedAt && (
            <span className="text-xs text-muted-foreground">
              Last scanned {new Date(brand.lastScannedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        {loadError && (
          <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {loadError}
          </div>
        )}
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center px-8 py-12">
          <p className="text-sm text-muted-foreground">Loading brand profile…</p>
        </div>
      ) : (
        <BrandMemoryTabs
          brand={brand}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onBrandChange={setBrand}
        />
      )}
    </div>
  );
}

export default function BrandPage() {
  // useSearchParams() requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={
      <div className="flex h-full min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading brand profile…</p>
      </div>
    }>
      <BrandPageInner />
    </Suspense>
  );
}
