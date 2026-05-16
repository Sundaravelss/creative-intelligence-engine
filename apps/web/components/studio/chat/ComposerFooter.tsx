"use client";

import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useState,
} from "react";
import { ArrowUp, CalendarClock, ChevronDown } from "lucide-react";
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
  { id: "openai", label: "OpenAI" },
  { id: "claude", label: "Claude Code" },
  { id: "pioneer", label: "Pioneer" },
  { id: "hermes", label: "Hermes" },
];

interface ComposerFooterProps {
  adapter: string;
  setAdapter: (id: string) => void;
  onSubmit: (text: string) => void;
  /** Open the schedule modal seeded with the current draft. */
  onSchedule?: (currentText: string) => void;
  disabled?: boolean;
}

export function ComposerFooter({
  adapter,
  setAdapter,
  onSubmit,
  onSchedule,
  disabled,
}: ComposerFooterProps) {
  const [text, setText] = useState("");

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const value = text.trim();
    if (!value || disabled) return;
    onSubmit(value);
    setText("");
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  const adapterLabel =
    ADAPTERS.find((a) => a.id === adapter)?.label ?? "Execute";

  const handleSchedule = () => {
    onSchedule?.(text);
  };

  return (
    <form
      onSubmit={submit}
      className="sticky bottom-0 z-10 border-t border-black/5 bg-background/95 px-3 py-3 backdrop-blur-md"
    >
      <div className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white/85 p-2 shadow-sm focus-within:border-black/20">
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
          <PlusMenu onSchedule={handleSchedule} />
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
                Execute · {adapterLabel}
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
          <Button
            type="submit"
            size="icon"
            disabled={!text.trim() || disabled}
            className="h-8 w-8 rounded-full bg-foreground text-background hover:bg-foreground/90"
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
