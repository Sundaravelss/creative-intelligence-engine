"use client";

import { FileText, Image as ImageIcon, Plug, Plus, Video } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function PlusMenu() {
  return (
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
        <DropdownMenuLabel>Attach</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <ImageIcon className="mr-2 h-4 w-4" /> Image
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Video className="mr-2 h-4 w-4" /> Video
        </DropdownMenuItem>
        <DropdownMenuItem>
          <FileText className="mr-2 h-4 w-4" /> Document
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Plug className="mr-2 h-4 w-4" /> From integration
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
