"use client";

// /splash — boot screen. After 3s, route to /onboarding (if not complete) or
// /studio. The redirect logic lives here (not /) because root is a server
// component that already gates on the flag.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getOnboardingState } from "@/lib/onboarding";

import { SplashScreen } from "@/components/onboarding/SplashScreen";

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(async () => {
      const state = await getOnboardingState().catch(() => ({
        complete: false,
      }));
      router.replace(state.complete ? "/studio" : "/onboarding");
    }, 3000);
    return () => clearTimeout(t);
  }, [router]);

  return <SplashScreen />;
}
