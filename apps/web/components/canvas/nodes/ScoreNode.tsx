"use client";

import { memo } from "react";
import type { NodeProps } from "reactflow";
import {
  scoreNodeSchema,
  nodeKindByName,
  type ScoreNodeData,
} from "@cie/canvas-nodes";
import { NodeShell, NodeField } from "./NodeShell";

/**
 * Score node has only an INPUT handle. The score is a terminal
 * observation, not something downstream consumers chain off of.
 *
 * NOTE: WS-F owns the actual ScoreChip + breakdown panel components in
 * the same `components/canvas/` directory. This node is content-only.
 */
function ScoreNodeInner({ data, selected }: NodeProps<ScoreNodeData>) {
  const safe = scoreNodeSchema.partial().safeParse(data);
  const d = safe.success ? safe.data : {};

  return (
    <NodeShell
      meta={nodeKindByName.score}
      selected={selected}
      showSource={false}
    >
      <NodeField label="Artifact" value={d.artifactId} />
      <NodeField label="Viral" value={typeof d.viralScore === "number" ? Math.round(d.viralScore) : undefined} />
      <NodeField label="Hook" value={typeof d.hookScore === "number" ? Math.round(d.hookScore) : undefined} />
      <NodeField
        label="Hold"
        value={typeof d.holdRate === "number" ? `${Math.round(d.holdRate * 100)}%` : undefined}
      />
    </NodeShell>
  );
}

export const ScoreNode = memo(ScoreNodeInner);
