"use client";

import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tokens } from "@openbento/ui";
import { cardNodeTypes } from "@/components/cards/registry";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useWorkspaceUi } from "@/components/workspace/workspace-ui";
import { buildCreateNoteCardInput } from "@/lib/domain/note-card";
import { FrameNode } from "./nodes/FrameNode";
import { CanvasToolbar } from "./CanvasToolbar";
import { FrameDrawLayer } from "./FrameDrawLayer";
import { cardNodeId, frameNodeId, parseFlowNodeId } from "./flow-ids";
import { useCanvasCommands } from "./use-canvas-commands";

import "@xyflow/react/dist/style.css";

const NODE_TYPES = {
  ...cardNodeTypes(),
  frame: FrameNode,
};

function nodesFromSnapshot(
  cards: ReturnType<typeof useWorkspace>["snapshot"]["cards"],
  frames: ReturnType<typeof useWorkspace>["snapshot"]["frames"],
  fullscreen: ReturnType<typeof useWorkspace>["snapshot"]["fullscreen"],
): Node[] {
  const active = Boolean(fullscreen?.active);
  const visibleFrames = active
    ? frames.filter((frame) => frame.id === fullscreen?.frameId)
    : frames;
  const visibleCards = active
    ? cards.filter((card) => card.frameId === fullscreen?.frameId)
    : cards;

  return [
    ...visibleFrames.map((frame) => ({
      id: frameNodeId(frame.id),
      type: "frame" as const,
      position: { x: frame.bounds.x, y: frame.bounds.y },
      style: { width: frame.bounds.width, height: frame.bounds.height },
      data: { frameId: frame.id },
      zIndex: frame.zIndex ?? 0,
      selectable: !active,
      draggable: !active,
    })),
    ...visibleCards.map((card) => ({
      id: cardNodeId(card.id),
      type: card.type,
      position: { ...card.position },
      style: { width: card.size.width, height: card.size.height },
      data: { cardId: card.id },
      zIndex: card.zIndex ?? 1,
      selectable: !active,
      draggable: !active,
    })),
  ];
}

function CanvasSurface() {
  const { snapshot, execute, undo, redo } = useWorkspace();
  const {
    frameToolActive,
    setFrameToolActive,
    snapToGrid,
  } = useWorkspaceUi();
  const { persistCardGeometry, persistFrameMove } = useCanvasCommands();
  const { screenToFlowPosition, setViewport, fitView } = useReactFlow();
  const interactingRef = useRef(false);
  const viewportTimer = useRef<number | null>(null);
  const canvas = snapshot.canvases.find(
    (entry) => entry.id === snapshot.currentCanvasId,
  );
  const canvasRef = useRef(canvas);
  const fullscreen = snapshot.fullscreen;
  const readOnly = Boolean(fullscreen?.active);

  const [nodes, setNodes] = useState<Node[]>(() =>
    nodesFromSnapshot(snapshot.cards, snapshot.frames, snapshot.fullscreen),
  );

  useEffect(() => {
    canvasRef.current = canvas;
  }, [canvas]);

  useEffect(() => {
    if (interactingRef.current) {
      return;
    }
    setNodes(nodesFromSnapshot(snapshot.cards, snapshot.frames, snapshot.fullscreen));
  }, [snapshot.cards, snapshot.frames, snapshot.fullscreen, snapshot.revision]);

  useEffect(() => {
    if (fullscreen?.active) {
      void fitView({ padding: 0.14, duration: 180 });
      return;
    }
    const current = canvasRef.current;
    if (current) {
      void setViewport(current.viewport, { duration: 0 });
    }
  }, [canvas?.id, fitView, fullscreen?.active, fullscreen?.frameId, setViewport]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z" && !typing) {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (event.key === "Escape") {
        setFrameToolActive(false);
        if (fullscreen?.active) {
          execute(
            "fullscreenFrame",
            { frameId: fullscreen.frameId, active: false },
            { history: false },
          );
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [execute, fullscreen, redo, setFrameToolActive, undo]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((current) => {
        let next = applyNodeChanges(changes, current);
        for (const change of changes) {
          if (change.type !== "position" || !change.position) {
            continue;
          }
          const parsed = parseFlowNodeId(change.id);
          if (parsed?.kind !== "frame") {
            continue;
          }
          const previous = current.find((node) => node.id === change.id);
          if (!previous) {
            continue;
          }
          const dx = change.position.x - previous.position.x;
          const dy = change.position.y - previous.position.y;
          if (dx === 0 && dy === 0) {
            continue;
          }
          next = next.map((node) => {
            const info = parseFlowNodeId(node.id);
            if (info?.kind !== "card") {
              return node;
            }
            const card = snapshot.cards.find((entry) => entry.id === info.entityId);
            if (card?.frameId !== parsed.entityId) {
              return node;
            }
            return {
              ...node,
              position: {
                x: node.position.x + dx,
                y: node.position.y + dy,
              },
            };
          });
        }
        return next;
      });
    },
    [snapshot.cards],
  );

  const defaultViewport = useMemo(
    () => canvas?.viewport ?? { x: 0, y: 0, zoom: 1 },
    [canvas?.viewport],
  );

  if (!canvas) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Create a Canvas to begin.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        key={canvas.id}
        nodes={nodes}
        edges={[]}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        defaultViewport={defaultViewport}
        minZoom={0.15}
        maxZoom={2.75}
        snapToGrid={snapToGrid}
        snapGrid={[16, 16]}
        nodesConnectable={false}
        edgesFocusable={false}
        elementsSelectable={!readOnly}
        nodesDraggable={!readOnly && !frameToolActive}
        panOnDrag={!frameToolActive}
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        selectionOnDrag={false}
        deleteKeyCode={null}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: false }}
        onNodeDragStart={() => {
          interactingRef.current = true;
        }}
        onNodeDragStop={(_event, node) => {
          interactingRef.current = false;
          const parsed = parseFlowNodeId(node.id);
          if (!parsed) {
            return;
          }
          if (parsed.kind === "card") {
            const card = snapshot.cards.find((entry) => entry.id === parsed.entityId);
            if (card) {
              persistCardGeometry(card, { position: node.position });
            }
          }
          if (parsed.kind === "frame") {
            const frame = snapshot.frames.find(
              (entry) => entry.id === parsed.entityId,
            );
            if (frame) {
              persistFrameMove(frame, node.position);
            }
          }
        }}
        onMoveEnd={(_event, viewport) => {
          if (readOnly) {
            return;
          }
          if (viewportTimer.current) {
            window.clearTimeout(viewportTimer.current);
          }
          viewportTimer.current = window.setTimeout(() => {
            execute(
              "updateCanvasViewport",
              {
                canvasId: canvas.id,
                viewport: {
                  x: viewport.x,
                  y: viewport.y,
                  zoom: viewport.zoom,
                },
              },
              { history: false },
            );
          }, 280);
        }}
        onDoubleClick={(event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) {
            return;
          }
          if (!target.classList.contains("react-flow__pane")) {
            return;
          }
          if (readOnly || frameToolActive) {
            return;
          }
          const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          execute(
            "createCard",
            buildCreateNoteCardInput({
              canvasId: canvas.id,
              position,
              text: "",
            }),
          );
        }}
      >
        <Background
          id="openbento-dots"
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.4}
          color={tokens.canvas.dot}
          bgColor={tokens.canvas.background}
        />
      </ReactFlow>
      {frameToolActive && !readOnly ? <FrameDrawLayer /> : null}
      {readOnly ? (
        <button
          type="button"
          className="absolute right-3 top-3 z-30 rounded-md border border-zinc-700 bg-[#141820]/95 px-3 py-1.5 text-xs text-zinc-200 shadow-lg hover:bg-zinc-800"
          onClick={() => {
            execute(
              "fullscreenFrame",
              { frameId: fullscreen!.frameId, active: false },
              { history: false },
            );
          }}
        >
          Exit fullscreen
        </button>
      ) : (
        <CanvasToolbar />
      )}
    </div>
  );
}

/**
 * XYFlow workspace mount. Zoom/pan/fit are camera-only.
 * No edges, connection handles, minimap, or semantic zoom.
 */
export function CanvasRoot() {
  return (
    <ReactFlowProvider>
      <CanvasSurface />
    </ReactFlowProvider>
  );
}
