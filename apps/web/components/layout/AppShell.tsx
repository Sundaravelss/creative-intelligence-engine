"use client";

import { SessionNavBar } from "@/components/ui/sidebar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen flex-row">
      <SessionNavBar />
      <main className="flex h-screen grow flex-col overflow-auto pl-[3.05rem]">
        {children}
      </main>
    </div>
  );
}
