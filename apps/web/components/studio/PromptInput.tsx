"use client";

import { ChangeEvent, KeyboardEvent } from "react";

interface PromptInputProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
}

const DEFAULT_MAX = 1000;

/**
 * Multiline prompt input with Cmd/Ctrl+Enter submit + character counter.
 *
 * Glass-styled with a single coral accent on focus to echo the system's
 * "alive" colour. Intentionally not a textarea-with-buttons component —
 * the Run button is owned by the page so the layout can flex.
 */
export function PromptInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Launch winter sneakers, Gen-Z, Paris…",
  disabled = false,
  maxLength = DEFAULT_MAX,
}: PromptInputProps) {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    if (next.length <= maxLength) onChange(next);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };

  const remaining = maxLength - value.length;
  const nearLimit = remaining < 80;

  return (
    <div
      className="hc-glass-strong relative rounded-[var(--hc-radius-card)] border border-[color:var(--color-border)] p-4 transition-shadow focus-within:shadow-[0_0_0_3px_var(--hc-accent-coral-soft)]"
      data-testid="cie-prompt-input"
    >
      <textarea
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        spellCheck={false}
        className="w-full resize-none bg-transparent text-base leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50"
      />
      <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>
          <kbd className="rounded border border-[color:var(--color-border)] px-1.5 py-0.5 font-mono text-[10px]">
            ⌘
          </kbd>
          <span className="mx-1">+</span>
          <kbd className="rounded border border-[color:var(--color-border)] px-1.5 py-0.5 font-mono text-[10px]">
            ↵
          </kbd>
          <span className="ml-2">to run</span>
        </span>
        <span className={nearLimit ? "hc-accent-coral" : ""}>
          {value.length} / {maxLength}
        </span>
      </div>
    </div>
  );
}
