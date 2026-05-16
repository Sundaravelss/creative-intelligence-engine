"use client";

import { memo } from "react";
import type { NodeProps } from "reactflow";
import {
  scheduleNodeSchema,
  nodeKindByName,
  type ScheduleNodeData,
} from "@cie/canvas-nodes";
import { NodeShell, NodeField } from "./NodeShell";

/**
 * Schedule node has only an INPUT handle — it's a sink.
 * The artifacts/loops it triggers are owned by WS-G.
 */
function ScheduleNodeInner({ data, selected }: NodeProps<ScheduleNodeData>) {
  const safe = scheduleNodeSchema.partial().safeParse(data);
  const d = safe.success ? safe.data : {};

  return (
    <NodeShell
      meta={nodeKindByName.schedule}
      selected={selected}
      showSource={false}
    >
      <NodeField label="Label" value={d.label} />
      <NodeField label="Cron" value={d.cron} />
      <NodeField label="Channel" value={d.channel} />
    </NodeShell>
  );
}

export const ScheduleNode = memo(ScheduleNodeInner);
