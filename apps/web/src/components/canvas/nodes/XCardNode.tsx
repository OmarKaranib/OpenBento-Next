"use client";

import type { Card } from "@openbento/domain";
import type { Node, NodeProps } from "@xyflow/react";
import {
  XCardContent,
  type XCard,
} from "@/components/cards/XCardContent";
import { SourceCardChrome } from "@/components/cards/SourceCardChrome";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";

export {
  compactMetric,
  compactXTimestamp,
  safeRenderableXMedia,
} from "@/components/cards/XCardContent";
export type { XCard } from "@/components/cards/XCardContent";

export type XNode = Node<{ cardId: string }, "x">;

/** Resolve only a persisted X Card; never coerce another source type. */
export function xCardForNode(
  cards: readonly Card[],
  cardId: string,
): XCard | null {
  const card = cards.find((entry) => entry.id === cardId);
  return card?.type === "x" ? card : null;
}

export function XCardNode({ data, selected }: NodeProps<XNode>) {
  const { snapshot } = useWorkspace();
  const card = xCardForNode(snapshot.cards, data.cardId);
  if (!card) return null;
  return (
    <SourceCardChrome
      card={card}
      selected={selected}
      label="X"
      minWidth={240}
      minHeight={160}
    >
      <XCardContent card={card} />
    </SourceCardChrome>
  );
}
