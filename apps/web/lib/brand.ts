// Live brand state — sourced from /api/brand when onboarding is complete,
// falls back to a sensible default when onboarding is incomplete or skipped.
//
// Components MUST read brandId from useBrand() rather than hardcoding any
// literal. The fallback ID is "allbirds" so the demo seed in fixtures/brand.json
// continues to work when a user skips onboarding.

"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { getOnboardingState, type OnboardingState } from "./onboarding";

interface BrandProfileLite {
  id: string;
  name: string;
  logoUrl?: string;
  palette?: string[];
  voice?: string;
  sourceUrl?: string;
}

const FALLBACK_BRAND_ID = "allbirds";
const FALLBACK_BRAND_NAME = "Allbirds";

export interface UseBrandResult {
  /** Stable id consumed by /api/agents/campaign etc. */
  brandId: string;
  /** Display name for headers and chat copy. */
  brandName: string;
  /** Whether onboarding has been completed (false → using fallback). */
  isComplete: boolean;
  /** True while either onboarding state or brand profile is in flight. */
  isLoading: boolean;
  /** Full brand profile if loaded; null otherwise. */
  profile: BrandProfileLite | null;
}

async function safeGetOnboarding(): Promise<OnboardingState | null> {
  try {
    return await getOnboardingState();
  } catch {
    return null;
  }
}

async function safeGetBrand(): Promise<BrandProfileLite | null> {
  try {
    return await api.get<BrandProfileLite>("/api/brand");
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    return null;
  }
}

export function useBrand(): UseBrandResult {
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [profile, setProfile] = useState<BrandProfileLite | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ob, br] = await Promise.all([safeGetOnboarding(), safeGetBrand()]);
      if (cancelled) return;
      setOnboarding(ob);
      setProfile(br);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isComplete = onboarding?.complete === true;
  const brandId = isComplete && profile?.id ? profile.id : FALLBACK_BRAND_ID;
  const brandName =
    isComplete && profile?.name ? profile.name : FALLBACK_BRAND_NAME;

  return { brandId, brandName, isComplete, isLoading, profile };
}

/**
 * Server-safe: derive brand id without hooks, used inside async event
 * handlers that need a value before the hook re-renders.
 */
export function brandIdFrom(profile: BrandProfileLite | null, isComplete: boolean): string {
  if (isComplete && profile?.id) return profile.id;
  return FALLBACK_BRAND_ID;
}
