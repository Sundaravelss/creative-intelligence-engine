"use client";

import { Loader2, Play } from "lucide-react";

interface RunButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
}

export function RunButton({
  onClick,
  loading = false,
  disabled = false,
  label = "Run",
}: RunButtonProps) {
  const isDisabled = loading || disabled;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      data-testid="cie-run-button"
      className={[
        "hc-pill inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold transition-all",
        "border border-transparent",
        isDisabled
          ? "cursor-not-allowed bg-[color:var(--hc-surface-recessed)] text-muted-foreground"
          : "bg-[color:var(--hc-accent-coral)] text-white shadow-[0_6px_20px_var(--hc-accent-coral-soft)] hover:translate-y-[-1px] hover:shadow-[0_10px_28px_var(--hc-accent-coral-soft)] active:translate-y-0",
      ].join(" ")}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Play size={14} fill="currentColor" />
      )}
      <span>{loading ? "Running…" : label}</span>
    </button>
  );
}
