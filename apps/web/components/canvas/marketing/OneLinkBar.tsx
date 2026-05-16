"use client";

import { useState } from "react";
import { Link2, Loader2, Sparkles } from "lucide-react";

interface OneLinkBarProps {
  onSubmit: (productUrl: string) => void;
  busy?: boolean;
  disabled?: boolean;
}

export function OneLinkBar({ onSubmit, busy = false, disabled = false }: OneLinkBarProps) {
  const [url, setUrl] = useState("");

  const submit = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      const parsed = new URL(trimmed);
      onSubmit(parsed.toString());
    } catch {
      // ignore — user can fix and resubmit
    }
  };

  return (
    <div
      className="hc-glass flex w-full items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-white/70 px-3 py-2 shadow-sm"
      role="search"
      aria-label="Marketing studio one-link"
    >
      <Link2 size={14} className="shrink-0 text-[color:var(--color-muted-foreground)]" />
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="One link in. Marketing out. Paste product URL…"
        disabled={busy || disabled}
        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[color:var(--color-muted-foreground)]"
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy || disabled || !url.trim()}
        className="hc-glass inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[oklch(0.66_0.18_25_/_0.9)] px-3 py-1 text-[12px] font-medium text-white hover:bg-[oklch(0.66_0.18_25)] disabled:opacity-50"
      >
        {busy ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Sparkles size={12} />
        )}
        <span>Launch campaign</span>
      </button>
    </div>
  );
}

export default OneLinkBar;
