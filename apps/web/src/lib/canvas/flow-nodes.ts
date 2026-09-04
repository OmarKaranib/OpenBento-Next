/**
 * XYFlow node projection for the current Canvas.
 *
 * Filtering is presentation-only: unmatched Cards are omitted from the node
 * list. Frame nodes stay so spatial context remains. Stored Card positions,
 * sizes, and frameId are never rewritten here.
 */

import type { Node } from "@xyflow/react";
import {
  isColumnActive,
  isFreeCardActive,
  type Card,
  type Column,
  type Frame,
  type FrameFullscreenView,
} from "@openbento/domain";
import {
  cardNodeId,
  columnNodeId,
  frameNodeId,
} from "@/components/canvas/flow-ids";

export type FlowNodesOptions = {
  /** Return false to hide a Card in the render path only. */
  cardVisible?: (card: Card) => boolean;
};

export function nodesFromSnapshot(
  cards: readonly Card[],
  frames: readonly Frame[],
  columns: readonly Column[],
  fullscreen: FrameFullscreenView | null | undefined,
  options?: FlowNodesOptions,
): Node[] {
  const active = Boolean(fullscreen?.active);
  const primaryFrame = frames.find((frame) =>
    active ? frame.id === fullscreen?.frameId : true,
  );
  const visibleFrames = active
    ? frames.filter((frame) => frame.id === fullscreen?.frameId)
    : frames;
  const visibleColumns = columns.filter((column) =>
    active && primaryFrame ? isColumnActive(column, primaryFrame) : true,
  );
  const visibleCards = cards
    .filter((card) => !card.columnId)
    .filter((card) =>
      active && primaryFrame ? isFreeCardActive(card, primaryFrame) : true,
    )
    .filter((card) => options?.cardVisible?.(card) ?? true);

  return [
    ...visibleFrames.map((frame) => ({
      id: frameNodeId(frame.id),
      type: "frame" as const,
      position: { x: frame.bounds.x, y: frame.bounds.y },
      style: { width: frame.bounds.width, height: frame.bounds.height },
      data: { frameId: frame.id },
      zIndex: frame.zIndex ?? 0,
      selectable: !active,
      draggable: false,
    })),
    ...visibleColumns.map((column) => {
      const parked = primaryFrame ? !isColumnActive(column, primaryFrame) : true;
      return {
        id: columnNodeId(column.id),
        type: "column" as const,
        position: { x: column.bounds.x, y: column.bounds.y },
        style: { width: column.bounds.width, height: column.bounds.height },
        className: parked ? "is-parked" : undefined,
        data: { columnId: column.id, parked },
        zIndex: column.zIndex ?? 1,
        selectable: true,
        draggable: true,
        dragHandle: ".openbento-column-drag-handle",
      };
    }),
    ...visibleCards.map((card) => {
      const parked = primaryFrame ? !isFreeCardActive(card, primaryFrame) : true;
      return {
        id: cardNodeId(card.id),
        type: card.type,
        position: { ...card.position },
        style: { width: card.size.width, height: card.size.height },
        className: parked ? "is-parked" : undefined,
        data: { cardId: card.id, parked },
        zIndex: card.zIndex ?? 2,
        selectable: true,
        draggable: true,
      };
    }),
  ];
}
