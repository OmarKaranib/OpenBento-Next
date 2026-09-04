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
import { containsRect, type Point } from "@openbento/domain";
import { cardNodeTypes } from "@/components/cards/registry";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useWorkspaceUi } from "@/components/workspace/workspace-ui";
import { buildCreateNoteCardInput } from "@/lib/domain/note-card";
import {
  cardSourceHref,
  contextMenuItems,
  isTypingTarget,
  preventBrowserContextMenu,
  resolveContextMenuTarget,
  selectedCardIds,
  type ContextMenuItemId,
  type ContextMenuTarget,
} from "@/lib/canvas/context-menu";
import { shouldApplyStoredViewport } from "@/lib/canvas/camera-sync";
import { FrameNode } from "./nodes/FrameNode";
import { ColumnNode, COLUMN_CARD_DRAG_TYPE } from "./nodes/ColumnNode";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasContextMenu, type CanvasContextMenuState } from "./CanvasContextMenu";
import { canvasDoubleClickShouldCreateNote } from "./empty-canvas-target";
import { parseFlowNodeId } from "./flow-ids";
import { useCanvasCommands } from "./use-canvas-commands";
import { nodesFromSnapshot } from "@/lib/canvas/flow-nodes";
import { useCanvasMonitor } from "@/components/workspace/canvas-monitor";
import {
  dashboardFitRequest,
  primaryDashboardFrame,
} from "@/lib/canvas/dashboard-view";
import {
  beginDashboardDrag,
  cardDashboardActivity,
  columnDashboardActivity,
  resolveDashboardDrag,
  type DashboardDragState,
} from "@/lib/canvas/dashboard-boundary";

import "@xyflow/react/dist/style.css";

const NODE_TYPES = {
  ...cardNodeTypes(),
  frame: FrameNode,
  column: ColumnNode,
};

type ActiveDashboardDrag = {
  nodeId: string;
  size: { width: number; height: number };
  state: DashboardDragState;
};

function pointerFromEvent(event: MouseEvent | TouchEvent): Point {
  if (event instanceof TouchEvent) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : { x: 0, y: 0 };
  }
  return { x: event.clientX, y: event.clientY };
}

function CanvasSurface() {
  const { session, snapshot, execute, commit, undo, redo } = useWorkspace();
  const {
    snapToGrid,
    openWatchBotCreate,
    workspaceElement,
    dashboardEdgeActive,
    setDashboardEdgeActive,
  } = useWorkspaceUi();
  const {
    persistCardGeometry,
    persistCreatedNote,
    persistCreatedColumn,
    persistColumnMove,
    detachCardFromColumn,
  } = useCanvasCommands();
  const { cardVisible, filter } = useCanvasMonitor();
  const { screenToFlowPosition, setViewport, fitBounds, getViewport } = useReactFlow();
  const interactingRef = useRef(false);
  const viewportTimer = useRef<number | null>(null);
  const dashboardDragRef = useRef<ActiveDashboardDrag | null>(null);
  const lastNoteCreateAt = useRef(0);
  const cameraKeyRef = useRef<{
    canvasId: string | undefined;
    fullscreen: boolean;
  }>({ canvasId: undefined, fullscreen: false });
  const menuTargetRef = useRef<ContextMenuTarget>({ variant: "canvas" });
  const menuWorldRef = useRef<{ x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<CanvasContextMenuState | null>(null);
  const canvas = snapshot.canvases.find(
    (entry) => entry.id === snapshot.currentCanvasId,
  );
  const canvasRef = useRef(canvas);
  const fullscreen = snapshot.fullscreen;
  const fullscreenActive = Boolean(fullscreen?.active);
  const primaryFrame = primaryDashboardFrame(snapshot);

  const [nodes, setNodes] = useState<Node[]>(() =>
    nodesFromSnapshot(snapshot.cards, snapshot.frames, snapshot.columns, snapshot.fullscreen, {
      cardVisible,
    }),
  );

  useEffect(() => {
    canvasRef.current = canvas;
  }, [canvas]);

  useEffect(
    () => () => {
      if (interactingRef.current) {
        interactingRef.current = false;
        void session.endInteraction();
      }
    },
    [canvas?.id, session],
  );

  useEffect(() => {
    if (interactingRef.current) {
      return;
    }
    setNodes(
      nodesFromSnapshot(snapshot.cards, snapshot.frames, snapshot.columns, snapshot.fullscreen, {
        cardVisible,
      }),
    );
  }, [
    snapshot.cards,
    snapshot.frames,
    snapshot.columns,
    snapshot.fullscreen,
    snapshot.revision,
    cardVisible,
    filter.query,
    filter.types,
    filter.sourceTypes,
    filter.newOnly,
  ]);

  useEffect(() => {
    const previous = cameraKeyRef.current;
    const decision = shouldApplyStoredViewport({
      previousCanvasId: previous.canvasId,
      nextCanvasId: canvas?.id,
      previousFullscreenActive: previous.fullscreen,
      fullscreenActive: Boolean(fullscreen?.active),
      // revision is intentionally omitted — poll publish must not move camera
      revisionChanged: false,
    });
    cameraKeyRef.current = {
      canvasId: canvas?.id,
      fullscreen: Boolean(fullscreen?.active),
    };
    if (decision === "fit") {
      if (primaryFrame) {
        const request = dashboardFitRequest(primaryFrame, "fullscreen");
        void fitBounds(request.bounds, request.options);
      }
      return;
    }
    if (decision === "restore") {
      const current = canvasRef.current;
      if (current) {
        void setViewport(current.viewport, { duration: 0 });
      }
    }
  }, [
    canvas?.id,
    fitBounds,
    fullscreen?.active,
    fullscreen?.frameId,
    primaryFrame,
    setViewport,
  ]);

  /** Browser fullscreen changes the container after the domain view activates. */
  useEffect(() => {
    if (!fullscreenActive || !primaryFrame || !workspaceElement) return;
    const refit = () => {
      window.requestAnimationFrame(() => {
        const request = dashboardFitRequest(primaryFrame, "fullscreen");
        void fitBounds(request.bounds, request.options);
      });
    };
    const observer = new ResizeObserver(refit);
    observer.observe(workspaceElement);
    document.addEventListener("fullscreenchange", refit);
    window.addEventListener("resize", refit);
    refit();
    return () => {
      observer.disconnect();
      document.removeEventListener("fullscreenchange", refit);
      window.removeEventListener("resize", refit);
    };
  }, [fitBounds, fullscreenActive, primaryFrame, workspaceElement]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target =
        event.target instanceof HTMLElement ? event.target : null;
      const typing = isTypingTarget(target);
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z" && !typing) {
        event.preventDefault();
        if (event.shiftKey) {
          void redo();
        } else {
          void undo();
        }
        return;
      }
      if (!typing && (event.key === "Delete" || event.key === "Backspace")) {
        const cardIds = selectedCardIds(nodes);
        if (cardIds.length > 0) {
          event.preventDefault();
          void commit(
            cardIds.map((cardId) => ({
              name: "deleteCard" as const,
              input: { cardId },
            })),
            { history: false },
          );
          return;
        }
      }
      if (event.key === "Escape") {
        if (fullscreen?.active) {
          void execute(
            "fullscreenFrame",
            { frameId: fullscreen.frameId, active: false },
            { history: false },
          );
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, execute, fullscreen, nodes, redo, undo]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((current) => applyNodeChanges(changes, current));
    },
    [],
  );

  const defaultViewport = useMemo(
    () => canvas?.viewport ?? { x: 0, y: 0, zoom: 1 },
    [canvas?.viewport],
  );

  const createNoteAtClientPoint = useCallback(
    (event: { clientX: number; clientY: number }) => {
      if (!canvas) {
        return;
      }
      const now = performance.now();
      if (now - lastNoteCreateAt.current < 350) {
        return;
      }
      lastNoteCreateAt.current = now;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      void persistCreatedNote(
        buildCreateNoteCardInput({
          canvasId: canvas.id,
          position,
          text: "",
        }),
      );
    },
    [canvas, persistCreatedNote, screenToFlowPosition],
  );

  const openContextMenu = useCallback(
    (event: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }, nodeId?: string) => {
      preventBrowserContextMenu(event);
      event.stopPropagation();
      const target = resolveContextMenuTarget(nodeId);
      const sourceHref =
        target.variant === "card"
          ? cardSourceHref(
              snapshot.cards.find((entry) => entry.id === target.cardId),
            )
          : null;
      const items = contextMenuItems({
        target,
        canUndo: snapshot.canUndo,
        canRedo: snapshot.canRedo,
        sourceHref,
      });
      menuTargetRef.current = target;
      menuWorldRef.current = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      if (items.length === 0) {
        setMenu(null);
        return;
      }
      setMenu({
        clientX: event.clientX,
        clientY: event.clientY,
        items,
      });
    },
    [
      screenToFlowPosition,
      snapshot.canRedo,
      snapshot.canUndo,
      snapshot.cards,
    ],
  );

  const closeContextMenu = useCallback(() => {
    setMenu(null);
  }, []);

  const onContextMenuAction = useCallback(
    (id: ContextMenuItemId) => {
      const target = menuTargetRef.current;
      const world = menuWorldRef.current;
      setMenu(null);
      if (id === "add-note" && canvas && world) {
        void persistCreatedNote(
          buildCreateNoteCardInput({
            canvasId: canvas.id,
            position: world,
            text: "",
          }),
        );
        return;
      }
      if (id === "create-column" && canvas && world) {
        void persistCreatedColumn(canvas.id, world);
        return;
      }
      if (id === "new-watchbot") {
        openWatchBotCreate();
        return;
      }
      if (id === "undo") {
        void undo();
        return;
      }
      if (id === "redo") {
        void redo();
        return;
      }
      if (id === "fit-view") {
        if (primaryFrame) {
          const request = dashboardFitRequest(primaryFrame, "return");
          void fitBounds(request.bounds, request.options);
        }
        return;
      }
      if (id === "open-source" && target.variant === "card") {
        const href = cardSourceHref(
          snapshot.cards.find((entry) => entry.id === target.cardId),
        );
        if (href) {
          window.open(href, "_blank", "noopener,noreferrer");
        }
        return;
      }
      if (id === "delete-card" && target.variant === "card") {
        void execute(
          "deleteCard",
          { cardId: target.cardId },
          { history: false },
        );
        return;
      }
    },
    [
      canvas,
      execute,
      fitBounds,
      openWatchBotCreate,
      primaryFrame,
      persistCreatedColumn,
      persistCreatedNote,
      redo,
      snapshot.cards,
      undo,
    ],
  );

  if (!canvas) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Create a Canvas to begin.
      </div>
    );
  }

  return (
    <div
      className={
        dashboardEdgeActive
          ? "dashboard-edge-active relative h-full w-full"
          : "relative h-full w-full"
      }
      onContextMenu={(event) => {
        if (!event.defaultPrevented) {
          openContextMenu(event);
        }
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(COLUMN_CARD_DRAG_TYPE)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(event) => {
        const cardId = event.dataTransfer.getData(COLUMN_CARD_DRAG_TYPE);
        if (
          !cardId ||
          (event.target instanceof Element &&
            event.target.closest("[data-column-id]"))
        ) {
          return;
        }
        event.preventDefault();
        const card = snapshot.cards.find((entry) => entry.id === cardId);
        const frame = snapshot.frames.find(
          (entry) => entry.id === canvas.primaryFrameId,
        );
        if (!card?.columnId || !frame) return;
        const world = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        const position = {
          x: world.x - card.size.width / 2,
          y: world.y - 24,
        };
        if (!containsRect(frame.bounds, { ...position, ...card.size })) return;
        void detachCardFromColumn(card.id, position, card.size);
      }}
    >
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
        elementsSelectable
        nodesDraggable
        panOnDrag={fullscreenActive ? false : [0]}
        panOnScroll={!fullscreenActive}
        zoomOnScroll={!fullscreenActive}
        zoomOnPinch={!fullscreenActive}
        selectionOnDrag={false}
        deleteKeyCode={null}
        zoomOnDoubleClick={false}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
        onPaneClick={(event) => {
          // Do not stopPropagation / preventDefault — the pane keeps pan/zoom.
          if (event.detail !== 2) {
            return;
          }
          createNoteAtClientPoint(event);
        }}
        onPaneContextMenu={(event) => {
          openContextMenu(event);
        }}
        onNodeContextMenu={(event, node) => {
          openContextMenu(event, node.id);
        }}
        onSelectionContextMenu={(event) => {
          openContextMenu(event);
        }}
        onNodeDragStart={(_event, node) => {
          interactingRef.current = true;
          setDashboardEdgeActive(false);
          const parsed = parseFlowNodeId(node.id);
          const source =
            parsed?.kind === "card"
              ? snapshot.cards.find((entry) => entry.id === parsed.entityId)
              : parsed?.kind === "column"
                ? snapshot.columns.find((entry) => entry.id === parsed.entityId)
                : null;
          if (source && primaryFrame) {
            const size =
              "size" in source
                ? source.size
                : { width: source.bounds.width, height: source.bounds.height };
            const semanticActive =
              parsed?.kind === "card"
                ? cardDashboardActivity(source.frameId, primaryFrame.id)
                : columnDashboardActivity(
                    source.frameId,
                    primaryFrame.id,
                    { position: node.position, size },
                    primaryFrame.bounds,
                  );
            const state = beginDashboardDrag(
              { position: node.position, size },
              primaryFrame.bounds,
              semanticActive,
            );
            dashboardDragRef.current = {
              nodeId: node.id,
              size,
              state,
            };
            if (
              state.displayedPosition.x !== node.position.x ||
              state.displayedPosition.y !== node.position.y
            ) {
              setNodes((current) =>
                current.map((entry) =>
                  entry.id === node.id
                    ? { ...entry, position: state.displayedPosition }
                    : entry,
                ),
              );
            }
          } else {
            dashboardDragRef.current = null;
          }
          session.beginInteraction();
        }}
        onNodeDrag={(_event, node) => {
          const drag = dashboardDragRef.current;
          if (!drag || drag.nodeId !== node.id || !primaryFrame) return;
          const resolved = resolveDashboardDrag(
            drag.state,
            node.position,
            pointerFromEvent(_event),
            getViewport().zoom,
            performance.now(),
            drag.size,
            primaryFrame.bounds,
          );
          dashboardDragRef.current = { ...drag, state: resolved.state };
          setDashboardEdgeActive(resolved.resisting);
          if (
            resolved.position.x !== node.position.x ||
            resolved.position.y !== node.position.y
          ) {
            setNodes((current) =>
              current.map((entry) =>
                entry.id === node.id
                  ? { ...entry, position: resolved.position }
                  : entry,
              ),
            );
          }
        }}
        onNodeDragStop={(_event, node) => {
          void (async () => {
            const drag = dashboardDragRef.current;
            const finalPosition =
              drag?.nodeId === node.id
                ? drag.state.displayedPosition
                : node.position;
            dashboardDragRef.current = null;
            try {
              const parsed = parseFlowNodeId(node.id);
              if (parsed?.kind === "card") {
                const card = snapshot.cards.find(
                  (entry) => entry.id === parsed.entityId,
                );
                if (card) {
                  await persistCardGeometry(card, { position: finalPosition });
                }
              }
              if (parsed?.kind === "column") {
                const column = snapshot.columns.find(
                  (entry) => entry.id === parsed.entityId,
                );
                if (column) {
                  await persistColumnMove(column, finalPosition);
                }
              }
            } finally {
              interactingRef.current = false;
              setDashboardEdgeActive(false);
              await session.endInteraction();
            }
          })();
        }}
        onMoveEnd={(_event, viewport) => {
          if (fullscreenActive) {
            return;
          }
          if (viewportTimer.current) {
            window.clearTimeout(viewportTimer.current);
          }
          viewportTimer.current = window.setTimeout(() => {
            void execute(
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
          if (
            !canvasDoubleClickShouldCreateNote({
              target: event.target,
              readOnly: false,
              frameToolActive: false,
            })
          ) {
            return;
          }
          createNoteAtClientPoint(event);
        }}
      >
        {fullscreenActive ? null : <Background
          id="openbento-dots"
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.4}
          color={tokens.canvas.dot}
          bgColor={tokens.canvas.background}
        />}
      </ReactFlow>
      <CanvasContextMenu
        state={menu}
        onClose={closeContextMenu}
        onAction={onContextMenuAction}
      />
      {fullscreenActive ? null : <CanvasToolbar />}
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
