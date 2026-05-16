"use client";

import { type ChangeEvent, useCallback, useRef } from "react";
import {
  CalendarClock,
  FileText,
  Image as ImageIcon,
  Plus,
  Video,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface PlusMenuProps {
  /** Optional callback when "Schedule loop" is selected. */
  onSchedule?: () => void;
  /** Optional callback when files are picked from the OS file dialog. */
  onFiles?: (files: File[]) => void;
}

const ACCEPT_IMAGE = "image/*";
const ACCEPT_VIDEO = "video/*";
const ACCEPT_DOC =
  ".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.ppt,.pptx,application/pdf";

export function PlusMenu({ onSchedule, onFiles }: PlusMenuProps = {}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const acceptRef = useRef<string>("*/*");

  const openPicker = useCallback((accept: string) => {
    acceptRef.current = accept;
    // Defer the click so Radix's DropdownMenu finishes closing before we
    // synthesize the click on the hidden <input>. Without this, the menu's
    // focus-restore handler intercepts the click and the OS file dialog
    // never opens. See radix-ui/primitives#1241.
    setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.accept = accept;
      el.value = "";
      el.click();
    }, 0);
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
        multiple
        className="hidden"
        onChange={handleChange}
        aria-hidden
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full border border-black/10 bg-white/70 hover:bg-white"
            aria-label="Add attachment"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel>Upload from your device</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              openPicker(ACCEPT_IMAGE);
            }}
          >
            <ImageIcon className="mr-2 h-4 w-4" /> Image
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              openPicker(ACCEPT_VIDEO);
            }}
          >
            <Video className="mr-2 h-4 w-4" /> Video
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              openPicker(ACCEPT_DOC);
            }}
          >
            <FileText className="mr-2 h-4 w-4" /> Document
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              onSchedule?.();
            }}
          >
            <CalendarClock className="mr-2 h-4 w-4" /> Schedule loop
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
