"use client";

/**
 * ScheduleModal — turns the active composer prompt into a scheduled loop.
 *
 * Hosted at the page level (studio/page.tsx and canvas/page.tsx). Opens
 * with the prompt prefilled from whichever composer triggered it. Saves
 * via POST /api/loops; backend cron worker (services/scheduler) picks
 * the new entry up automatically.
 *
 * Dialog shell mirrors apps/web/components/canvas/export/ExportDialog.tsx
 * (fixed overlay, body-scroll lock, click-outside close, X button) so we
 * don't pull in shadcn's full Dialog primitive.
 */

import { useEffect, useState } from "react";
import { CalendarClock, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { api, ApiError } from "@/lib/api";

interface ScheduleModalProps {
  open: boolean;
  initialPrompt: string;
  onClose: () => void;
}

const CHANNELS = [
  "instagram",
  "tiktok",
  "facebook",
  "youtube",
  "meta-ads",
  "tiktok-ads",
  "google-ads",
] as const;

const FORMATS = ["post", "story", "reel", "ad"] as const;

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  cron: z
    .string()
    .min(1, "Cron is required")
    .regex(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/, "Cron must be 5 fields, e.g. '0 9 * * *'"),
  channel: z.string().min(1, "Channel is required"),
  prompt: z.string().min(1, "Prompt is required"),
  format: z.string().min(1, "Format is required"),
});

function defaultName(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return "Daily loop";
  const head = trimmed.length > 30 ? trimmed.slice(0, 30).trim() + "…" : trimmed;
  return `Loop — ${head}`;
}

export function ScheduleModal({ open, initialPrompt, onClose }: ScheduleModalProps) {
  const [name, setName] = useState("");
  const [cron, setCron] = useState("0 9 * * *");
  const [channel, setChannel] = useState<string>("meta-ads");
  const [format, setFormat] = useState<string>("post");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state every time the modal opens with a fresh seed prompt.
  useEffect(() => {
    if (!open) return;
    setName(defaultName(initialPrompt));
    setPrompt(initialPrompt);
    setCron("0 9 * * *");
    setChannel("meta-ads");
    setFormat("post");
    setError(null);
    setSubmitting(false);
  }, [open, initialPrompt]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setError(null);
    const parsed = schema.safeParse({ name, cron, channel, prompt, format });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/loops", parsed.data);
      toast.success(`Loop saved · cron ${cron}`);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : "Failed to save loop";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Schedule loop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="hc-glass relative w-full max-w-xl rounded-xl border border-white/40 bg-white/90 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close schedule dialog"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-black hover:bg-black/20"
        >
          <X size={14} />
        </button>

        <header className="mb-4 flex items-center gap-2">
          <CalendarClock size={18} className="text-[oklch(0.66_0.18_25)]" />
          <div>
            <h2 className="hc-serif-headline text-lg font-semibold leading-tight">
              Schedule loop
            </h2>
            <p className="text-[12px] text-[color:var(--color-muted-foreground)]">
              This prompt will run on the cadence below. Cron is UTC.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-[color:var(--color-border)] bg-white/80 px-3 py-2 outline-none focus:border-[oklch(0.66_0.18_25_/_0.6)]"
              placeholder="Daily Instagram post"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Cron (UTC)</span>
            <input
              type="text"
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              className="rounded-md border border-[color:var(--color-border)] bg-white/80 px-3 py-2 font-mono outline-none focus:border-[oklch(0.66_0.18_25_/_0.6)]"
              placeholder="0 9 * * *"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Channel</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="rounded-md border border-[color:var(--color-border)] bg-white/80 px-3 py-2 outline-none focus:border-[oklch(0.66_0.18_25_/_0.6)]"
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Format</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="rounded-md border border-[color:var(--color-border)] bg-white/80 px-3 py-2 outline-none focus:border-[oklch(0.66_0.18_25_/_0.6)]"
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 flex flex-col gap-1 text-sm">
          <span>Prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="rounded-md border border-[color:var(--color-border)] bg-white/80 px-3 py-2 outline-none focus:border-[oklch(0.66_0.18_25_/_0.6)]"
            placeholder="Generate a post about today's top product highlight…"
          />
        </label>

        {error ? (
          <div className="mt-3 text-[12px] text-destructive" role="alert">
            {error}
          </div>
        ) : null}

        <footer className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-[12px] text-[color:var(--color-muted-foreground)] hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="hc-glass inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.66_0.18_25_/_0.9)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[oklch(0.66_0.18_25)] disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <CalendarClock size={12} />
            )}
            <span>Save schedule</span>
          </button>
        </footer>
      </div>
    </div>
  );
}

export default ScheduleModal;
