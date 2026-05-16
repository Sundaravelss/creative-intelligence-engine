"use client";

import { memo } from "react";
import type { NodeProps } from "reactflow";
import {
  videoGenNodeSchema,
  nodeKindByName,
  type VideoGenNodeData,
} from "@cie/canvas-nodes";
import { ArtifactRenderer, type VideoArtifact } from "@cie/ui-artifacts";
import { NodeShell, NodeField } from "./NodeShell";

function VideoGenNodeInner({ id, data, selected }: NodeProps<VideoGenNodeData>) {
  const safe = videoGenNodeSchema.partial().safeParse(data);
  const d = safe.success ? safe.data : {};

  const artifact: VideoArtifact | null = d.artifactUrl
    ? {
        id: `${id}-art`,
        type: "video",
        name: "preview",
        url: d.artifactUrl,
      }
    : null;

  return (
    <NodeShell meta={nodeKindByName.videoGen} selected={selected}>
      {artifact && (
        <div className="-mx-3 -mt-2 mb-1 overflow-hidden">
          <ArtifactRenderer artifact={artifact} className="aspect-video w-full object-cover" />
        </div>
      )}
      <NodeField label="Prompt" value={d.prompt} />
      <NodeField label="Model" value={d.model} />
      <NodeField label="Duration" value={d.duration ? `${d.duration}s` : undefined} />
      <NodeField label="Camera" value={d.camera} />
      <NodeField label="Motion" value={d.motion} />
    </NodeShell>
  );
}

export const VideoGenNode = memo(VideoGenNodeInner);
