// Onboarding state — persisted server-side at fixtures/onboarding.json via
// services/api/routers/onboarding.py.
//
// W1 calls getOnboardingState() at boot to decide between /splash → /onboarding
// vs /studio, and calls setOnboardingComplete(brandUrl) on Phase 5 "Proceed"
// before redirecting.

import { api } from "./api";

export interface OnboardingState {
  complete: boolean;
  brandUrl?: string;
  completedAt?: string;
}

export async function getOnboardingState(): Promise<OnboardingState> {
  return api.get<OnboardingState>("/api/onboarding/state");
}

export async function setOnboardingComplete(
  brandUrl: string,
): Promise<OnboardingState> {
  return api.put<OnboardingState>("/api/onboarding/state", {
    complete: true,
    brandUrl,
    completedAt: new Date().toISOString(),
  });
}
