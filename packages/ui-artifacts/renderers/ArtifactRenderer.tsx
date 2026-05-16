import { ExternalLink } from "lucide-react";
import { cn } from "../shared/cn";
import type { Artifact } from "../types";
import { DocumentRenderer } from "./DocumentRenderer";
import { ImageRenderer } from "./ImageRenderer";
import { VideoRenderer } from "./VideoRenderer";
import { SlideRenderer } from "./SlideRenderer";
import { TableRenderer } from "./TableRenderer";
import { CodeRenderer } from "./CodeRenderer";

interface ArtifactRendererProps {
  artifact: Artifact;
  className?: string;
}

export function ArtifactRenderer({ artifact, className }: ArtifactRendererProps) {
  switch (artifact.type) {
    case "document":
      return <DocumentRenderer artifact={artifact} className={className} />;
    case "image":
      return <ImageRenderer artifact={artifact} className={className} />;
    case "video":
      return <VideoRenderer artifact={artifact} className={className} />;
    case "slides":
      return <SlideRenderer artifact={artifact} className={className} />;
    case "table":
      return <TableRenderer artifact={artifact} className={className} />;
    case "code":
      return <CodeRenderer artifact={artifact} className={className} />;
    case "webpage":
      return (
        <div className={cn("p-6 flex flex-col gap-2", className)}>
          {artifact.title && (
            <h3 className="hc-serif-headline text-xl font-semibold">{artifact.title}</h3>
          )}
          {artifact.snippet && <p className="text-sm leading-relaxed">{artifact.snippet}</p>}
          <a
            href={artifact.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm inline-flex items-center gap-1 underline underline-offset-2"
          >
            {artifact.url} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      );
  }
}
