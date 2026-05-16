"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { FormatPicker, type StudioFormat } from "@/components/studio/FormatPicker";

/**
 * Serializable subset of `SpaceTemplate` — the parent server component
 * cannot pass the full template (it contains a `LucideIcon` function ref
 * for `icon`, which won't cross the server→client boundary).
 */
export interface SpaceStepsInput {
  id: string;
  name: string;
  description: string;
  defaultPrompt: string;
}

type StepId = 1 | 2;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

interface UploadedFile {
  id: string;
  file: File;
  previewUrl: string | null;
  kind: "image" | "video" | "other";
}

interface SpaceStepsProps {
  space: SpaceStepsInput;
}

function detectKind(file: File): UploadedFile["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "other";
}

/**
 * Reads the URL hash (#step=1 / #step=2) so the step state is shareable
 * and survives reload. Falls back to step 1 on first paint.
 */
function useStepFromHash(): [StepId, (step: StepId) => void] {
  const [step, setStep] = useState<StepId>(1);

  useEffect(() => {
    const sync = (): void => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const match = /step=(1|2)/.exec(hash);
      setStep(match ? (Number(match[1]) as StepId) : 1);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const go = useCallback((next: StepId): void => {
    if (typeof window === "undefined") return;
    window.location.hash = `step=${next}`;
  }, []);

  return [step, go];
}

export function SpaceSteps({ space }: SpaceStepsProps) {
  const router = useRouter();
  const [step, goStep] = useStepFromHash();

  // Step 1 state
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Step 2 state
  const [prompt, setPrompt] = useState<string>(space.defaultPrompt);
  const [format, setFormat] = useState<StudioFormat>("square");
  const [brandId, setBrandId] = useState<string>("allbirds");
  const [launching, setLaunching] = useState(false);

  // Cleanup blob URLs on unmount.
  useEffect(() => {
    return () => {
      uploads.forEach((u) => {
        if (u.previewUrl) URL.revokeObjectURL(u.previewUrl);
      });
    };
    // We deliberately don't depend on `uploads` — this is unmount-only cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiles = useCallback((files: FileList | File[]): void => {
    const accepted = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
    );
    if (accepted.length === 0) {
      toast.error("Only image and video files are accepted.");
      return;
    }
    const next: UploadedFile[] = accepted.map((f, idx) => ({
      id: `${Date.now()}-${idx}-${f.name}`,
      file: f,
      previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      kind: detectKind(f),
    }));
    setUploads((prev) => [...prev, ...next]);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const onSelectFiles = useCallback(
    (e: ChangeEvent<HTMLInputElement>): void => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
      // Reset so the same file can be re-selected if removed.
      e.target.value = "";
    },
    [handleFiles],
  );

  const removeUpload = useCallback((id: string): void => {
    setUploads((prev) => {
      const target = prev.find((u) => u.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((u) => u.id !== id);
    });
  }, []);

  const canContinue = uploads.length > 0;

  const handleLaunch = useCallback(async (): Promise<void> => {
    if (!prompt.trim()) {
      toast.error("Add a prompt before launching.");
      return;
    }
    setLaunching(true);
    try {
      const res = await fetch(`${API_BASE}/api/agents/campaign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: { keyword: prompt },
          format,
          brand_id: brandId,
          space_id: space.id,
          uploads: uploads.map((u) => ({
            name: u.file.name,
            kind: u.kind,
            size: u.file.size,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`Campaign request failed: ${res.status}`);
      }

      // Pull the run id from the first SSE chunk if present, otherwise
      // fall back to a synthetic id so the redirect still lands somewhere
      // useful for the demo.
      const runId = res.headers.get("x-run-id") ?? `run-${Date.now()}`;
      toast.success("Campaign launched");
      router.push(`/studio?campaign=${encodeURIComponent(runId)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to launch";
      toast.error(msg);
      setLaunching(false);
    }
  }, [prompt, format, brandId, uploads, space.id, router]);

  const stepIndicator = useMemo(
    () => (
      <div
        className="flex items-center gap-3"
        aria-label={`Step ${step} of 2`}
        data-testid="cie-space-steps-indicator"
      >
        <StepDot active={step === 1} done={step === 2} label="1" />
        <div className="h-px w-10 bg-[color:var(--color-border)]" aria-hidden />
        <StepDot active={step === 2} done={false} label="2" />
        <span className="ml-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Step <span className="font-semibold text-foreground">{step}</span> of 2 ·{" "}
          <span className={step === 1 ? "font-semibold text-foreground" : ""}>
            Upload
          </span>{" "}
          ·{" "}
          <span className={step === 2 ? "font-semibold text-foreground" : ""}>
            Configure
          </span>
        </span>
      </div>
    ),
    [step],
  );

  return (
    <div className="flex flex-col gap-8">
      {stepIndicator}

      {step === 1 ? (
        <section className="flex flex-col gap-5">
          <header className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight">
              Upload your inputs
            </h2>
            <p className="text-sm text-muted-foreground">
              Drop product images or short videos. We'll use them as visual
              anchors for {space.name.toLowerCase()}.
            </p>
          </header>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            data-testid="cie-space-dropzone"
            className={[
              "relative flex h-48 cursor-pointer flex-col items-center justify-center gap-2",
              "rounded-2xl border-2 border-dashed transition-colors",
              isDragging
                ? "border-[color:var(--hc-accent-coral)] bg-[color:var(--hc-accent-coral-soft)]"
                : "border-[color:var(--color-border)] bg-[color:var(--hc-surface-elevated)] hover:border-[color:var(--hc-accent-coral)]",
            ].join(" ")}
          >
            <UploadCloud
              size={28}
              className="text-[color:var(--hc-accent-coral)]"
              aria-hidden
            />
            <p className="text-sm font-medium">
              Drag & drop, or <span className="underline">browse</span>
            </p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, MP4, MOV — up to 50 MB each
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={onSelectFiles}
              className="sr-only"
              aria-label="Upload files"
            />
          </div>

          {uploads.length > 0 && (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {uploads.map((u) => (
                <li
                  key={u.id}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-[color:var(--color-border)] bg-[color:var(--hc-surface-elevated)]"
                >
                  {u.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.previewUrl}
                      alt={u.file.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
                      {u.kind === "video" ? "VIDEO" : "FILE"}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeUpload(u.id);
                    }}
                    aria-label={`Remove ${u.file.name}`}
                    className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => goStep(2)}
              data-testid="cie-space-continue"
              className={[
                "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all",
                canContinue
                  ? "bg-[color:var(--hc-accent-coral)] text-white shadow-[0_4px_12px_var(--hc-accent-coral-soft)] hover:-translate-y-0.5"
                  : "cursor-not-allowed bg-[color:var(--hc-surface-elevated)] text-muted-foreground",
              ].join(" ")}
            >
              Continue →
            </button>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-5">
          <header className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight">
              Configure your brief
            </h2>
            <p className="text-sm text-muted-foreground">
              Adjust the prompt, output format, and brand. We'll launch a live
              run on Studio.
            </p>
          </header>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Prompt
            </span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="hc-glass w-full resize-none rounded-xl border border-[color:var(--color-border)] bg-[color:var(--hc-surface-elevated)] p-3 text-sm focus-visible:border-[color:var(--hc-accent-coral)] focus-visible:outline-none"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Format
            </span>
            <FormatPicker value={format} onChange={setFormat} />
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Brand
            </span>
            <input
              type="text"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="hc-glass w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--hc-surface-elevated)] px-3 py-2 text-sm focus-visible:border-[color:var(--hc-accent-coral)] focus-visible:outline-none"
            />
          </label>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => goStep(1)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to upload
            </button>
            <button
              type="button"
              disabled={launching}
              onClick={handleLaunch}
              data-testid="cie-space-launch"
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--hc-accent-coral)] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_var(--hc-accent-coral-soft)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {launching ? <Loader2 size={14} className="animate-spin" /> : null}
              {launching ? "Launching…" : "Launch campaign"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

interface StepDotProps {
  active: boolean;
  done: boolean;
  label: string;
}

function StepDot({ active, done, label }: StepDotProps) {
  return (
    <span
      aria-hidden
      className={[
        "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
        active
          ? "bg-[color:var(--hc-accent-coral)] text-white shadow-[0_2px_8px_var(--hc-accent-coral-soft)]"
          : done
            ? "bg-[color:var(--hc-accent-coral-soft)] text-[color:var(--hc-accent-coral)]"
            : "border border-[color:var(--color-border)] bg-[color:var(--hc-surface-elevated)] text-muted-foreground",
      ].join(" ")}
    >
      {label}
    </span>
  );
}
