"use client";

import { Loader2, Send } from "lucide-react";
import { useState } from "react";

interface BriefComposerProps {
  busy?: boolean;
  disabled?: boolean;
  onSubmit: (brief: string) => void;
  /** Comma-joined preview of active prompt modifiers (presets + character). */
  modifiersPreview?: string;
}

export function BriefComposer({
  busy = false,
  disabled = false,
  onSubmit,
  modifiersPreview,
}: BriefComposerProps) {
  const [text, setText] = useState("");

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <div className="hc-glass flex w-full flex-col gap-1 rounded-xl border border-[color:var(--color-border)] bg-white/70 p-2 shadow-sm">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        rows={2}
        placeholder="Describe one scene. We'll fan it into a 6-shot storyboard."
        disabled={busy || disabled}
        className="min-h-[44px] w-full resize-none bg-transparent px-2 py-1 text-[14px] outline-none placeholder:text-[color:var(--color-muted-foreground)]"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-[color:var(--color-muted-foreground)]">
          {modifiersPreview ? `+ ${modifiersPreview}` : "Cmd/Ctrl + Enter to launch"}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={busy || disabled || !text.trim()}
          className="hc-glass inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[oklch(0.66_0.18_25_/_0.9)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[oklch(0.66_0.18_25)] disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Send size={12} />
          )}
          <span>Generate storyboard</span>
        </button>
      </div>
    </div>
  );
}

export default BriefComposer;
