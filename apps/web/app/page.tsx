// Root redirect.
//
// Server component: hits the API directly (the client-side getOnboardingState()
// helper isn't usable here). On any failure we fall through to /splash so the
// user always sees something instead of a server error.

import { redirect } from "next/navigation";

const API_BASE_URL =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8100";

interface OnboardingStateResponse {
  complete?: boolean;
}

async function readOnboardingComplete(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/onboarding/state`, {
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as OnboardingStateResponse;
    return Boolean(data.complete);
  } catch {
    return false;
  }
}

export default async function HomePage(): Promise<never> {
  const complete = await readOnboardingComplete();
  if (!complete) redirect("/splash");
  redirect("/studio");
}
