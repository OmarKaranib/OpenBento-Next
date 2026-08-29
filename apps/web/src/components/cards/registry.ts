/**
 * Card type registry. Note is first. Future YouTube/article types register
 * here — do not add a second canvas engine for those types.
 */

import type { ComponentType } from "react";
import type { NodeProps } from "@xyflow/react";
import type { CardType, Size } from "@openbento/domain";
import { NoteCardNode } from "@/components/canvas/nodes/NoteCardNode";

export type CardTypeModule = {
  type: CardType;
  label: string;
  creatable: boolean;
  defaultSize: Size;
  Node: ComponentType<NodeProps>;
};

const registry = new Map<CardType, CardTypeModule>();

export function registerCardType(module: CardTypeModule): void {
  registry.set(module.type, module);
}

export function getCardType(type: CardType): CardTypeModule | undefined {
  return registry.get(type);
}

export function listCreatableCardTypes(): CardTypeModule[] {
  return [...registry.values()].filter((entry) => entry.creatable);
}

export function cardNodeTypes(): Record<string, ComponentType<NodeProps>> {
  const types: Record<string, ComponentType<NodeProps>> = {};
  for (const entry of registry.values()) {
    types[entry.type] = entry.Node;
  }
  return types;
}

registerCardType({
  type: "note",
  label: "Note",
  creatable: true,
  defaultSize: { width: 240, height: 160 },
  Node: NoteCardNode as ComponentType<NodeProps>,
});
