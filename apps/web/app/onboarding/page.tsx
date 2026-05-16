"use client";

// /onboarding — vertical-feed onboarding (NOT swap-on-advance).
//
// Each phase appends below the previous one as the user advances. The page is
// scrollable so the user can scroll back up to see "Assembling your agents"
// once they've moved past it. Auto-scroll-to-bottom on each new phase.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { setOnboardingComplete } from "@/lib/onboarding";

import { AgentsAssembly } from "@/components/onboarding/AgentsAssembly";
import { BrandIntakeChat } from "@/components/onboarding/BrandIntakeChat";
import {
  ScanProgress,
  type BrandProfileLite,
} from "@/components/onboarding/ScanProgress";
import { StoreLinkBar } from "@/components/onboarding/StoreLinkBar";
import { CreditsReward } from "@/components/onboarding/CreditsReward";
import { BrandConfirmCard } from "@/components/onboarding/BrandConfirmCard";

type Phase = "agents" | "intake" | "scanning" | "reward" | "confirm";

const PHASE_ORDER: Phase[] = ["agents", "intake", "scanning", "reward", "confirm"];

function phasesUpTo(current: Phase, hasUrl: boolean): Phase[] {
  const idx = PHASE_ORDER.indexOf(current);
  const all = PHASE_ORDER.slice(0, idx + 1);
  // Skip "scanning" when the user pressed Skip (no URL).
  return hasUrl ? all : all.filter((p) => p !== "scanning");
}

export default function OnboardingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("agents");
  const [url, setUrl] = useState<string>("");
  const [profile, setProfile] = useState<BrandProfileLite>({});
  const [proceeding, setProceeding] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Phase 4 → 5 auto-advance.
  useEffect(() => {
    if (phase !== "reward") return;
    const t = setTimeout(() => setPhase("confirm"), 1800);
    return () => clearTimeout(t);
  }, [phase]);

  // Auto-scroll to the bottom on each new phase so the latest section is in view
  // but the user can still scroll up to revisit prior phases (Assembling agents,
  // intake bubble, etc.).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [phase]);

  const handleScan = useCallback((next: string) => {
    setUrl(next);
    setPhase("scanning");
  }, []);

  const handleSkip = useCallback(() => {
    setProfile({});
    setPhase("reward");
  }, []);

  const handleScanComplete = useCallback((next: BrandProfileLite) => {
    setProfile(next);
    setPhase("reward");
  }, []);

  const handleProceed = useCallback(async () => {
    setProceeding(true);
    try {
      await setOnboardingComplete(profile.sourceUrl ?? url ?? "");
    } catch {
      // best-effort persistence; we still proceed to /studio
    }
    router.replace("/studio");
  }, [profile, url, router]);

  const visible = phasesUpTo(phase, url.length > 0);
  const showStoreBar = phase === "intake";

  return (
    <div className="relative flex min-h-screen w-full flex-col">
      {/* Blurred landscape backdrop */}
      <div className="fixed inset-0 -z-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/splash/landscape-bg.webp"
          alt=""
          aria-hidden="true"
          className="h-full w-full scale-110 object-cover opacity-60 blur-3xl"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/70 to-white/90" />
      </div>

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col gap-16 px-4 pt-16 pb-44">
        {visible.includes("agents") ? (
          <motion.section
            key="agents"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <AgentsAssembly onAdvance={() => setPhase("intake")} />
          </motion.section>
        ) : null}

        {visible.includes("intake") ? (
          <motion.section
            key="intake"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <BrandIntakeChat variant="intake" />
          </motion.section>
        ) : null}

        {visible.includes("scanning") ? (
          <motion.section
            key="scanning"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <BrandIntakeChat variant="scanning" url={url}>
              <ScanProgress url={url} onComplete={handleScanComplete} />
            </BrandIntakeChat>
          </motion.section>
        ) : null}

        {visible.includes("reward") ? (
          <motion.section
            key="reward"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <CreditsReward />
          </motion.section>
        ) : null}

        {visible.includes("confirm") ? (
          <motion.section
            key="confirm"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex w-full flex-col items-center gap-6"
          >
            <BrandConfirmCard
              profile={profile}
              onRetry={() => {
                setProfile({});
                setUrl("");
                setPhase("intake");
              }}
              onProceed={handleProceed}
              proceeding={proceeding}
            />
          </motion.section>
        ) : null}

        <div ref={bottomRef} aria-hidden="true" />
      </main>

      {showStoreBar ? (
        <StoreLinkBar onScan={handleScan} onSkip={handleSkip} />
      ) : null}
    </div>
  );
}
