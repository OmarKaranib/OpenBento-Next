"use client";

import { useReactFlow } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useWorkspaceUi } from "@/components/workspace/workspace-ui";
import { useCanvasCommands } from "./use-canvas-commands";

type Draft = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startClientX: number;
  startClientY: number;
};

function screenRect(draft: Draft): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const left = Math.min(draft.startX, draft.currentX);
  const top = Math.min(draft.startY, draft.currentY);
  return {
    left,
    top,
    width: Math.abs(draft.currentX - draft.startX),
    height: Math.abs(draft.currentY - draft.startY),
  };
}

export function FrameDrawLayer() {
  const { session, snapshot } = useWorkspace();
  const { setFrameToolActive } = useWorkspaceUi();
  const { persistCreatedFrame } = useCanvasCommands();
  const { screenToFlowPosition } = useReactFlow();
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const canvasId = snapshot.currentCanvasId;

  useEffect(
    () => () => {
      if (draftRef.current) {
        draftRef.current = null;
        void session.endInteraction();
      }
    },
    [session],
  );

  if (!canvasId) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-10 cursor-crosshair"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const host = event.currentTarget.getBoundingClientRect();
        const next = {
          startX: event.clientX - host.left,
          startY: event.clientY - host.top,
          currentX: event.clientX - host.left,
          currentY: event.clientY - host.top,
          startClientX: event.clientX,
          startClientY: event.clientY,
        };
        draftRef.current = next;
        setDraft(next);
        session.beginInteraction();
      }}
      onPointerMove={(event) => {
        const current = draftRef.current;
        if (!current) return;
        const host = event.currentTarget.getBoundingClientRect();
        const next = {
          ...current,
          currentX: event.clientX - host.left,
          currentY: event.clientY - host.top,
        };
        draftRef.current = next;
        setDraft(next);
      }}
      onPointerUp={(event) => {
        const current = draftRef.current;
        if (!current) return;
        const a = screenToFlowPosition({
          x: current.startClientX,
          y: current.startClientY,
        });
        const b = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        const bounds = {
          x: Math.min(a.x, b.x),
          y: Math.min(a.y, b.y),
          width: Math.abs(b.x - a.x),
          height: Math.abs(b.y - a.y),
        };
        draftRef.current = null;
        setDraft(null);
        setFrameToolActive(false);
        if (bounds.width >= 48 && bounds.height >= 48) {
          void persistCreatedFrame(canvasId, bounds, "Frame").finally(() => {
            void session.endInteraction();
          });
        } else {
          void session.endInteraction();
        }
      }}
      onPointerCancel={() => {
        if (!draftRef.current) return;
        draftRef.current = null;
        setDraft(null);
        setFrameToolActive(false);
        void session.endInteraction();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      {draft ? (
        <div
          className="pointer-events-none absolute rounded-md border border-dashed border-indigo-300/80 bg-indigo-400/10"
          style={screenRect(draft)}
        />
      ) : null}
    </div>
  );
}
