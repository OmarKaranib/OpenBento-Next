/**
 * XYFlow node projection for the current Canvas.
 *
 * Filtering is presentation-only: unmatched Cards are omitted from the node
 * list. Frame nodes stay so spatial context remains. Stored Card positions,
 * sizes, and frameId are never rewritten here.
 */

import type { Node } from "@xyflow/react";
import type { Card, Frame, FrameFullscreenView } from "@openbento/domain";
import { cardNodeId, frameNodeId } from "@/components/canvas/flow-ids";

export type FlowNodesOptions = {
  /** Return false to hide a Card in the render path only. */
  cardVisible?: (card: Card) => boolean;
};

export function nodesFromSnapshot(
  cards: readonly Card[],
  frames: readonly Frame[],
  fullscreen: FrameFullscreenView | null | undefined,
  options?: FlowNodesOptions,
): Node[] {
  const active = Boolean(fullscreen?.active);
  const visibleFrames = active
    ? frames.filter((frame) => frame.id === fullscreen?.frameId)
    : frames;
  const visibleCards = (active
    ? cards.filter((card) => card.frameId === fullscreen?.frameId)
    : cards
  ).filter((card) => options?.cardVisible?.(card) ?? true);

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
