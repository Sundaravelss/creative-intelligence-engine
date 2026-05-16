"use client";

import { SessionNavBar } from "@/components/ui/sidebar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen flex-row overflow-hidden">
      <SessionNavBar />
      {/*
        `overflow-hidden` (NOT `overflow-auto`) so the page itself never
        scrolls — child surfaces (chat rail, canvas) each own their own
        scroll containers. Without this, the chat thread grows and pushes
        the canvas off-screen instead of scrolling internally.
      */}
      <main className="flex h-screen grow flex-col overflow-hidden pl-[3.05rem]">
        {children}
      </main>
    </div>
  );
}
