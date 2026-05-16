"use client";

import { Briefcase, ChevronDown } from "lucide-react";

interface BrandPillProps {
  brandName: string;
  onClick?: () => void;
}

export function BrandPill({ brandName, onClick }: BrandPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-white"
    >
      <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
      <span>Brand · {brandName}</span>
      <ChevronDown className="h-3 w-3 text-muted-foreground" />
    </button>
  );
}
