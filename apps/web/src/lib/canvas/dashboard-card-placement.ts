import { PRIMARY_FRAME_BOUNDS, findFreeCardPosition, type Point, type Size } from "@openbento/domain";
import type { SessionSnapshot } from "@/lib/domain/workspace-session";

/**
 * Placement for human-created free Cards. It ignores camera state, preserves
 * all current geometry, and refuses to place a Card outside the dashboard.
 */
export function dashboardFreeCardPosition(snapshot: Pick<SessionSnapshot, "cards" | "columns" | "canvases" | "frames" | "currentCanvasId">, size: Size): Point {
  const canvas = snapshot.canvases.find((entry) => entry.id === snapshot.currentCanvasId);
  const frame = snapshot.frames.find((entry) => entry.id === canvas?.primaryFrameId);
  const bounds = frame?.bounds ?? PRIMARY_FRAME_BOUNDS;
  return findFreeCardPosition(
    [
      ...snapshot.cards.filter((card) => !card.columnId).map((card) => ({ position: card.position, size: card.size })),
      ...snapshot.columns.map((column) => ({
        position: { x: column.bounds.x, y: column.bounds.y },
        size: { width: column.bounds.width, height: column.bounds.height },
      })),
    ],
    size,
    { bounds },
  );
}
