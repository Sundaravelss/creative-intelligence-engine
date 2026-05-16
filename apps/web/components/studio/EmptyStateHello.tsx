"use client";

import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ArrowUp, CalendarClock, GitFork, Mic, Plug, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { ConnectorDropdown } from "./ConnectorDropdown";
import { QuickActions } from "./QuickActions";

export interface BrandProfile {
  id?: string;
  name?: string;
  voice?: string;
  logoUrl?: string;
}

interface EmptyStateHelloProps {
  brand: BrandProfile | null;
  onSubmit: (text: string) => void;
  /** Open the schedule modal seeded with the current draft. */
  onSchedule?: (currentText: string) => void;
  disabled?: boolean;
}

const NOISE_SVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`;

export function EmptyStateHello({
  brand,
  onSubmit,
  onSchedule,
  disabled,
}: EmptyStateHelloProps) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const brandName = brand?.name ?? "there";

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text || disabled) return;
    onSubmit(text);
  }, [draft, disabled, onSubmit]);

  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  // Auto-grow textarea up to ~140px.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft]);

  const handleQuickPrefill = useCallback(
    (text: string) => {
      if (!text) return;
      setDraft(text);
      // Focus and place caret at end after the value lands.
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(text.length, text.length);
      });
    },
    [],
  );

  return (
    <section className="relative flex h-full flex-col items-center justify-center overflow-hidden px-8">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(135deg, #dcd2e6 0%, #e8dde0 50%, #e7d6c5 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.04]"
        style={{ backgroundImage: `url("${NOISE_SVG}")` }}
      />

      <div className="mb-12 text-center">
        <h1 className="font-serif text-5xl tracking-tight text-foreground sm:text-6xl">
          Hello {brandName}
        </h1>
        <p className="mt-3 font-serif text-2xl text-muted-foreground">
          What are we going to sell today?
        </p>
      </div>

      <div className="w-full max-w-[760px]">
        <div
          data-testid="cie-hello-composer"
          className={cn(
            "rounded-2xl border border-border/70 bg-white/80 p-4 backdrop-blur-md",
            "shadow-[0_1px_2px_oklch(0.14_0_0_/_0.04),0_8px_24px_oklch(0.14_0_0_/_0.08)]",
          )}
        >
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            disabled={disabled}
            rows={2}
            placeholder="Ask Sage anything... Type / for skills"
            className={cn(
              "block w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed text-foreground outline-none",
              "placeholder:text-muted-foreground/70",
            )}
          />

          <div className="mt-3 flex items-center justify-between">
            <ConnectorDropdown
              trigger={
                <button
                  type="button"
                  aria-label="Add connector"
                  className="flex size-9 items-center justify-center rounded-full border border-border/70 bg-white text-foreground transition-colors hover:bg-muted"
                >
                  <Plus className="size-4" />
                </button>
              }
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Voice input"
                className="flex size-9 items-center justify-center rounded-full border border-border/70 bg-white text-foreground transition-colors hover:bg-muted"
              >
                <Mic className="size-4" />
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={disabled || !draft.trim()}
                aria-label="Send"
                className={cn(
                  "flex size-9 items-center justify-center rounded-full bg-foreground text-background transition-opacity",
                  "disabled:opacity-40",
                  !disabled && draft.trim() && "hover:opacity-90",
                )}
              >
                <ArrowUp className="size-4" />
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <ConnectorDropdown
              trigger={
                <button
                  type="button"
                  aria-label="Connectors"
                  className="flex size-7 items-center justify-center rounded-full border border-border/60 bg-white/80 text-muted-foreground transition-colors hover:bg-white"
                >
                  <Plug className="size-3.5" />
                </button>
              }
            />
            <button
              type="button"
              aria-label="Workflow"
              className="flex size-7 items-center justify-center rounded-full border border-border/60 bg-white/80 text-muted-foreground transition-colors hover:bg-white"
            >
              <GitFork className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Schedule loop"
              title="Schedule this prompt as a recurring loop"
              onClick={() => onSchedule?.(draft)}
              className="flex size-7 items-center justify-center rounded-full border border-border/60 bg-white/80 text-muted-foreground transition-colors hover:bg-white"
            >
              <CalendarClock className="size-3.5" />
            </button>
          </div>
        </div>

        <QuickActions brand={brand} onSelect={handleQuickPrefill} />
      </div>
    </section>
  );
}
