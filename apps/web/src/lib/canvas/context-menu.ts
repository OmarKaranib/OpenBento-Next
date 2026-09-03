/**
 * Canvas right-click menu: target variants, items, pointer world coords,
 * and viewport clamping. Writes go through ACTION_CATALOG / WorkspaceSession
 * only — this module does not invent actions.
 */

import type { ActionName, Card, Point, Viewport } from "@openbento/domain";
import { ACTION_NAMES } from "@openbento/domain";
import { parseFlowNodeId } from "@/components/canvas/flow-ids";
import { provenanceDisplay } from "@/lib/canvas/provenance-display";
import { safeHttpUrl } from "@/lib/untrusted";

export const FRAME_DEFAULT_SIZE = { width: 320, height: 200 } as const;

export type ContextMenuVariant = "canvas" | "card" | "frame";

export type ContextMenuTarget =
  | { variant: "canvas" }
  | { variant: "card"; cardId: string }
  | { variant: "frame"; frameId: string };

export type ContextMenuItemId =
  | "add-note"
  | "create-frame"
  | "new-watchbot"
  | "undo"
  | "redo"
  | "fit-view"
  | "open-source"
  | "fullscreen-frame";

export type ContextMenuItem = {
  id: ContextMenuItemId;
  label: string;
  disabled: boolean;
  /** Catalog / session action this item performs, or null for camera/UI. */
  actionName: ActionName | "undo" | "redo" | "fitView" | "openSource" | null;
};

const CANVAS_ITEMS: ContextMenuItemId[] = [
  "add-note",
  "create-frame",
  "new-watchbot",
  "undo",
  "redo",
  "fit-view",
];

export function preventBrowserContextMenu(event: {
  preventDefault: () => void;
}): void {
  event.preventDefault();
}

export function resolveContextMenuTarget(
  nodeId: string | null | undefined,
): ContextMenuTarget {
  if (!nodeId) {
    return { variant: "canvas" };
  }
  const parsed = parseFlowNodeId(nodeId);
  if (parsed?.kind === "card") {
    return { variant: "card", cardId: parsed.entityId };
  }
  if (parsed?.kind === "frame") {
    return { variant: "frame", frameId: parsed.entityId };
  }
  return { variant: "canvas" };
}

export function cardSourceHref(card: Card | undefined): string | null {
  if (!card) {
    return null;
  }
  const fromProvenance = provenanceDisplay(card)?.href ?? null;
  if (fromProvenance) {
    return fromProvenance;
  }
  return safeHttpUrl(
    "provenance" in card.payload ? card.payload.provenance.sourceUrl : null,
  );
}

export function contextMenuItems(args: {
  target: ContextMenuTarget;
  canUndo: boolean;
  canRedo: boolean;
  sourceHref?: string | null;
}): ContextMenuItem[] {
  const { target, canUndo, canRedo, sourceHref } = args;
  if (target.variant === "card") {
    const items: ContextMenuItem[] = [];
    const href = sourceHref ?? null;
    if (href) {
      items.push({
        id: "open-source",
        label: "Open Source",
        disabled: false,
        actionName: "openSource",
      });
    }
    return items;
  }
  if (target.variant === "frame") {
    return [
      {
        id: "fullscreen-frame",
        label: "Fullscreen Frame",
        disabled: false,
        actionName: "fullscreenFrame",
      },
    ];
  }
  return CANVAS_ITEMS.map((id) => {
    if (id === "undo") {
      return {
        id,
        label: "Undo",
        disabled: !canUndo,
        actionName: "undo",
      };
    }
    if (id === "redo") {
      return {
        id,
        label: "Redo",
        disabled: !canRedo,
        actionName: "redo",
      };
    }
    if (id === "add-note") {
      return {
        id,
        label: "Add Note here",
        disabled: false,
        actionName: "createCard",
      };
    }
    if (id === "create-frame") {
      return {
        id,
        label: "Create Frame here",
        disabled: false,
        actionName: "createFrame",
      };
    }
    if (id === "new-watchbot") {
      return {
        id,
        label: "New WatchBot",
        disabled: false,
        actionName: null,
      };
    }
    return {
      id,
      label: "Fit view",
      disabled: false,
      actionName: "fitView",
    };
  });
}

/**
 * Convert a client (screen) point to flow/world coordinates.
 * Matches React Flow: `(client - wrapperOrigin - viewport.translate) / zoom`.
 */
export function clientToFlowPosition(
  client: Point,
  viewport: Viewport,
  origin: Point = { x: 0, y: 0 },
): Point {
  return {
    x: (client.x - origin.x - viewport.x) / viewport.zoom,
    y: (client.y - origin.y - viewport.y) / viewport.zoom,
  };
}

export function frameBoundsAtPoint(position: Point): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: position.x,
    y: position.y,
    width: FRAME_DEFAULT_SIZE.width,
    height: FRAME_DEFAULT_SIZE.height,
  };
}

export function clampMenuPosition(
  point: Point,
  menu: { width: number; height: number },
  viewport: { width: number; height: number },
): Point {
  const maxX = Math.max(0, viewport.width - menu.width);
  const maxY = Math.max(0, viewport.height - menu.height);
  return {
    x: Math.min(Math.max(0, point.x), maxX),
    y: Math.min(Math.max(0, point.y), maxY),
  };
}

export function shouldCloseContextMenu(event: {
  type: string;
  key?: string;
}): boolean {
  if (event.type === "keydown" && event.key === "Escape") {
    return true;
  }
  if (event.type === "pointerdown" || event.type === "mousedown") {
    return true;
  }
  return false;
}

/** Menu writes must stay inside the locked 20-name catalog. */
export function contextMenuCatalogActions(): ActionName[] {
  return ACTION_NAMES.filter((name) =>
    (
      [
        "createCard",
        "createFrame",
        "fullscreenFrame",
      ] as ActionName[]
    ).includes(name),
  );
}

export function isKnownActionName(name: string): name is ActionName {
  return (ACTION_NAMES as readonly string[]).includes(name);
}
