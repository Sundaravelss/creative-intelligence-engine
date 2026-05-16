"use client";

import { useState } from "react";
import { z } from "zod";

import type { CreateLoopInput } from "./types";

interface LoopFormProps {
  onCreate: (input: CreateLoopInput) => Promise<void>;
}

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

const CHANNELS = [
  "instagram",
  "tiktok",
  "linkedin",
  "x",
  "facebook",
  "youtube",
  "meta-ads",
  "tiktok-ads",
  "google-ads",
];

export function LoopForm({ onCreate }: LoopFormProps) {
  const [name, setName] = useState("");
  const [cron, setCron] = useState("0 9 * * *");
  const [channel, setChannel] = useState("instagram");
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState("post");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ name, cron, channel, prompt, format });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSubmitting(true);
    try {
      await onCreate(parsed.data);
      setName("");
      setPrompt("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create loop");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="hc-card flex flex-col gap-3 p-5">
      <div className="hc-display text-sm font-semibold">New loop</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-border focus:border-ring focus:ring-ring/30 rounded-md border bg-background px-3 py-2 outline-none focus:ring-2"
            placeholder="Daily Instagram post"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Cron (UTC)</span>
          <input
            type="text"
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            className="border-border focus:border-ring focus:ring-ring/30 rounded-md border bg-background px-3 py-2 font-mono outline-none focus:ring-2"
            placeholder="0 9 * * *"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Channel</span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="border-border focus:border-ring focus:ring-ring/30 rounded-md border bg-background px-3 py-2 outline-none focus:ring-2"
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
            className="border-border focus:border-ring focus:ring-ring/30 rounded-md border bg-background px-3 py-2 outline-none focus:ring-2"
          >
            <option value="post">post</option>
            <option value="story">story</option>
            <option value="reel">reel</option>
            <option value="ad">ad</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span>Prompt</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="border-border focus:border-ring focus:ring-ring/30 rounded-md border bg-background px-3 py-2 outline-none focus:ring-2"
          placeholder="Generate a post about today's top product highlight…"
        />
      </label>
      {error ? (
        <div className="text-destructive text-xs" role="alert">
          {error}
        </div>
      ) : null}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="hc-pill bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create loop"}
        </button>
      </div>
    </form>
  );
}
