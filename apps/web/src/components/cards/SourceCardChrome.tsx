"use client";

import { NodeResizer } from "@xyflow/react";
import type { Card } from "@openbento/domain";
import { useCanvasCommands } from "@/components/canvas/use-canvas-commands";
import { NewCardBadge } from "@/components/cards/NewCardBadge";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useCanvasMonitorOptional } from "@/components/workspace/canvas-monitor";
import { sourceKindLabel } from "@/lib/canvas/provenance-display";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SourceCardChrome({
  card,
  selected,
  label,
  children,
  minWidth,
  minHeight,
}: {
  card: Card;
  selected: boolean;
  label?: string;
  children: ReactNode;
  minWidth: number;
  minHeight: number;
}) {
  const { snapshot } = useWorkspace();
  const { persistCardGeometry } = useCanvasCommands();
  const monitor = useCanvasMonitorOptional();
  const readOnly = Boolean(snapshot.fullscreen?.active);
  const isNew = monitor?.isCardNew(card.id) ?? false;
  const kind = label ?? sourceKindLabel(card) ?? "Source";

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-[#2a3140] bg-[#161a22] shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
        isNew && "ring-1 ring-indigo-400/70",
      )}
      style={{ minWidth, minHeight }}
    >
      <NodeResizer
        isVisible={selected && !readOnly}
        minWidth={minWidth}
        minHeight={minHeight}
        color="#64748b"
        onResizeEnd={(_event, params) => {
          persistCardGeometry(card, {
            position: { x: params.x, y: params.y },
            size: { width: params.width, height: params.height },
          });
        }}
      />
      <div className="flex h-7 shrink-0 items-center gap-2 px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
        <span>{kind}</span>
        {isNew ? <NewCardBadge /> : null}
      </div>
      <div className="min-h-0 flex-1 px-3 pb-3">{children}</div>
    </div>
  );
}
