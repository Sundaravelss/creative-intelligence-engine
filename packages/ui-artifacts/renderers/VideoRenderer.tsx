import { cn } from "../shared/cn";
import type { VideoArtifact } from "../types";

interface VideoRendererProps {
  artifact: VideoArtifact;
  className?: string;
}

export function VideoRenderer({ artifact, className }: VideoRendererProps) {
  return (
    <div className={cn("flex items-center justify-center w-full h-full", className)}>
      <video
        src={artifact.url}
        poster={artifact.poster}
        controls
        playsInline
        preload="metadata"
        className="max-w-full max-h-[70vh] rounded-lg shadow-md"
      />
    </div>
  );
}
