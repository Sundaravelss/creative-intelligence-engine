"use client";

import { useRef, useState } from "react";

import { API_BASE_URL } from "../../lib/api";

interface LogoUploaderProps {
  logoUrl?: string;
  onUploaded: (url: string) => void;
}

interface LogoUploadResponse {
  url: string;
  filename: string;
  bytes: string;
}

export function LogoUploader({ logoUrl, onUploaded }: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE_URL}/api/brand/logo`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed (${res.status}): ${text}`);
      }
      const body: LogoUploadResponse = await res.json();
      onUploaded(body.url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
    } finally {
      setBusy(false);
      // Reset the input so re-uploading the same file fires onChange again.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // Resolve relative logo URLs through the API origin so they render in dev.
  const resolvedSrc = logoUrl
    ? logoUrl.startsWith("http")
      ? logoUrl
      : `${API_BASE_URL}${logoUrl}`
    : null;

  return (
    <div className="flex items-center gap-4">
      <div className="bg-muted flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border">
        {resolvedSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- intentional: dev-served fixture, not a Next-optimized asset
          <img src={resolvedSrc} alt="Brand logo" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-muted-foreground text-xs">No logo</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label className="hc-pill cursor-pointer rounded-full border px-4 py-1.5 text-sm hover:bg-muted">
          {busy ? "Uploading…" : "Upload logo"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleChange}
            disabled={busy}
            className="hidden"
          />
        </label>
        {error ? <span className="text-destructive text-xs">{error}</span> : null}
        <span className="text-muted-foreground text-xs">PNG, JPG, SVG, WebP. Max 5 MB.</span>
      </div>
    </div>
  );
}

export default LogoUploader;
