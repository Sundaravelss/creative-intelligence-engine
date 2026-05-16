"use client";

import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useState,
} from "react";
import { ArrowUp, CalendarClock, ChevronDown, Square, X } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { PlusMenu } from "../PlusMenu";

const ADAPTERS: Array<{ id: string; label: string }> = [
  { id: "claude_code", label: "Claude Code" },
  { id: "openai", label: "OpenAI" },
  { id: "pioneer", label: "Pioneer" },
  { id: "hermes", label: "Hermes" },
];

interface ChatAttachment {
  url: string;
  filename: string;
  contentType: string;
  preview: string; // local object URL for thumbnail
}

interface ComposerFooterProps {
  adapter: string;
  setAdapter: (id: string) => void;
  /**
   * Submit handler. The caller decides how to thread `attachments` into
   * the chat thread + the API payload. The composer never inlines them
   * as text tags itself.
   */
  onSubmit: (text: string, attachments: ChatAttachment[]) => void;
  /** Open the schedule modal seeded with the current draft. */
  onSchedule?: (currentText: string) => void;
  disabled?: boolean;
  /** True while a campaign is streaming. Replaces send with a Stop button. */
  isRunning?: boolean;
  /** Aborts the in-progress campaign fetch. Required when `isRunning`. */
  onStop?: () => void;
}

const API_BASE =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL) ||
  "http://localhost:8100";

export function ComposerFooter({
  adapter,
  setAdapter,
  onSubmit,
  onSchedule,
  disabled,
  isRunning,
  onStop,
}: ComposerFooterProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFiles = useCallback(async (files: File[]) => {
    setUploading(true);
    try {
      // Upload sequentially so we get clean error messages per file.
      for (const f of files) {
        const form = new FormData();
        form.append("file", f, f.name);
        const res = await fetch(`${API_BASE}/api/chat/upload`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const detail = await res.text();
          toast.error(`Upload failed: ${f.name} (${res.status})`);
          console.error("upload", res.status, detail);
          continue;
        }
        const payload = (await res.json()) as {
          url: string;
          filename: string;
          contentType: string;
        };
        setAttachments((curr) => [
          ...curr,
          {
            url: payload.url,
            filename: payload.filename,
            contentType: payload.contentType,
            preview: URL.createObjectURL(f),
          },
        ]);
      }
    } finally {
      setUploading(false);
    }
  }, []);

  const removeAttachment = useCallback((idx: number) => {
    setAttachments((curr) => {
      const a = curr[idx];
      if (a) URL.revokeObjectURL(a.preview);
      return curr.filter((_, i) => i !== idx);
    });
  }, []);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const value = text.trim();
    if (!value && attachments.length === 0) return;
    if (disabled) return;
    // Pass attachments as a structured field so the page can (a) render
    // them as thumbnails in the user bubble and (b) include them as a
    // proper `attachments` field on the chat-completions request.
    onSubmit(value, attachments);
    // Don't revoke the preview URLs here — the page may still be
    // rendering the user bubble that references them. The thread item
    // owns the lifecycle from this point.
    setAttachments([]);
    setText("");
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  const handleSchedule = () => {
    onSchedule?.(text);
  };

  return (
    <form
      onSubmit={submit}
      className="sticky bottom-0 z-10 border-t border-black/5 bg-background/95 px-3 py-3 backdrop-blur-md"
    >
      <div className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white/85 p-2 shadow-sm focus-within:border-black/20">
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-1">
            {attachments.map((a, idx) => (
              <div
                key={a.url}
                className="group relative h-16 w-16 overflow-hidden rounded-lg border border-black/10 bg-muted/30"
                title={a.filename}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.preview}
                  alt={a.filename}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label={`Remove ${a.filename}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {uploading ? (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-black/15 text-[10px] text-muted-foreground">
                Uploading…
              </div>
            ) : null}
          </div>
        ) : null}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Add a follow-up…"
          className="max-h-32 min-h-[36px] w-full resize-none bg-transparent px-2 py-1 text-[13.5px] leading-relaxed outline-none placeholder:text-muted-foreground"
          disabled={disabled}
        />
        <div className="flex items-center gap-2">
          <PlusMenu onSchedule={handleSchedule} onFiles={handleFiles} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSchedule}
            aria-label="Schedule loop"
            title="Schedule this prompt as a recurring loop"
            className="h-8 w-8 rounded-full border border-black/10 bg-white/70 hover:bg-white"
          >
            <CalendarClock className="h-4 w-4" />
          </Button>
          <span className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 rounded-full border-black/10 bg-white/70 text-[12px] font-medium hover:bg-white"
              >
                Execute
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Adapter</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={adapter} onValueChange={setAdapter}>
                {ADAPTERS.map((a) => (
                  <DropdownMenuRadioItem key={a.id} value={a.id}>
                    {a.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="text-[11px]">
                ⌘+Enter to send
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isRunning ? (
            <Button
              type="button"
              size="icon"
              onClick={onStop}
              data-testid="cie-composer-stop"
              className="h-8 w-8 rounded-full bg-foreground text-background hover:bg-foreground/90"
              aria-label="Stop streaming"
              title="Stop the in-progress run"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!text.trim() || disabled}
              className="h-8 w-8 rounded-full bg-foreground text-background hover:bg-foreground/90"
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
