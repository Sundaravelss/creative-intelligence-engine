"use client";

import { type ChangeEvent, useCallback, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlusMenuProps {
  /** Optional callback when "Schedule loop" is selected. (Kept for API
   * compatibility with callers that previously used the dropdown variant.) */
  onSchedule?: () => void;
  /** Callback when files are picked from the OS file dialog. */
  onFiles?: (files: File[]) => void;
  /** Restrict the picker. Defaults to "image/*". */
  accept?: string;
}

/**
 * The composer's "+" button. A single click opens the OS file picker
 * directly — no dropdown menu, no Radix focus dance. This was a deliberate
 * regression over the prior dropdown UX after multiple browser-specific bugs
 * caused the picker to silently fail to open. If we want a multi-modal menu
 * back later (Image / Video / Document / Schedule), bring it back as a
 * SECONDARY affordance and keep the primary `+` click as a direct picker.
 *
 * Schedule-loop is currently exposed via a sibling button in the composer
 * footer (calendar icon), so dropping it from `+` doesn't lose any feature.
 */
export function PlusMenu({ onFiles, accept = "image/*" }: PlusMenuProps = {}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.value = "";
    el.click();
  }, []);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      if (!list || list.length === 0) return;
      onFiles?.(Array.from(list));
      e.target.value = "";
    },
    [onFiles],
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={handleChange}
        aria-hidden
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={openPicker}
        className="h-8 w-8 rounded-full border border-black/10 bg-white/70 hover:bg-white"
        aria-label="Attach an image"
        title="Attach an image"
        data-testid="cie-composer-attach"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </>
  );
}
