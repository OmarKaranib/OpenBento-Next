"use client";

import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { Maximize2 } from "lucide-react";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useCanvasCommands } from "@/components/canvas/use-canvas-commands";

export type FrameNode = Node<{ frameId: string }, "frame">;

export function FrameNode({ data, selected }: NodeProps<FrameNode>) {
  const { session, snapshot, execute } = useWorkspace();
  const { persistFrameResize } = useCanvasCommands();
  const frame = snapshot.frames.find((entry) => entry.id === data.frameId);
  const readOnly = Boolean(snapshot.fullscreen?.active);
  const storedName = frame?.name ?? "Frame";
  const [name, setName] = useState<string | null>(null);

  if (!frame) {
    return null;
  }

  return (
    <div className="relative h-full w-full rounded-lg border-2 border-[#4a5568] bg-[rgba(22,26,34,0.28)]">
      <NodeResizer
        isVisible={selected && !readOnly}
        minWidth={120}
        minHeight={80}
        color="#94a3b8"
        onResizeStart={() => {
          session.beginInteraction();
        }}
        onResizeEnd={(_event, params) => {
          void persistFrameResize(frame, {
            position: { x: params.x, y: params.y },
            size: { width: params.width, height: params.height },
          }).finally(() => {
            void session.endInteraction();
          });
        }}
      />
      <div className="absolute -top-7 left-0 flex items-center gap-1">
        <input
          className="nodrag nowheel nopan h-6 max-w-[220px] rounded-md border border-zinc-700 bg-[#161a22] px-2 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
          value={name ?? storedName}
          readOnly={readOnly}
          aria-label="Frame name"
          onFocus={() => {
            session.beginInteraction();
            setName(storedName);
          }}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            const next = (name ?? storedName).trim() || "Frame";
            setName(null);
            const persist =
              !readOnly && next !== (frame.name ?? "Frame")
                ? execute("updateFrame", { frameId: frame.id, name: next })
                : Promise.resolve();
            void persist.finally(() => {
              void session.endInteraction();
            });
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
        />
        {readOnly ? null : (
          <button
            type="button"
            className="nodrag nopan flex h-6 w-6 items-center justify-center rounded-md border border-zinc-700 bg-[#161a22] text-zinc-400 hover:text-zinc-100"
            aria-label="Fullscreen Frame"
            onClick={() => {
              void execute(
                "fullscreenFrame",
                { frameId: frame.id, active: true },
                { history: false },
              );
            }}
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
