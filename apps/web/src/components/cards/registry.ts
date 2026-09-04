/**
 * Card type registry. Note, YouTube, Article, Web, News, and X register here —
 * do not add a second canvas engine for those types.
 */

import type { ComponentType } from "react";
import type { NodeProps } from "@xyflow/react";
import type { CardType, Size } from "@openbento/domain";
import { NOTE_DEFAULT_SIZE } from "@/lib/domain/note-card";
import {
  SOURCE_LINK_DEFAULT_SIZE,
  YOUTUBE_DEFAULT_SIZE,
} from "@/lib/domain/source-card";
import { NoteCardNode } from "@/components/canvas/nodes/NoteCardNode";
import {
  ArticleCardNode,
  NewsCardNode,
  WebCardNode,
} from "@/components/canvas/nodes/ArticleCardNode";
import { XCardNode } from "@/components/canvas/nodes/XCardNode";
import { YoutubeCardNode } from "@/components/canvas/nodes/YoutubeCardNode";
import { StockCardNode } from "@/components/canvas/nodes/StockCardNode";
import { STOCK_DEFAULT_SIZE } from "@/lib/domain/stock-card";

export type CardCreateMode = "note" | "source" | "stock";

export type CardTypeModule = {
  type: CardType;
  label: string;
  creatable: boolean;
  createMode: CardCreateMode;
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
  createMode: "note",
  defaultSize: NOTE_DEFAULT_SIZE,
  Node: NoteCardNode as ComponentType<NodeProps>,
});

registerCardType({
  type: "chart",
  label: "Stock",
  creatable: true,
  createMode: "stock",
  defaultSize: STOCK_DEFAULT_SIZE,
  Node: StockCardNode as ComponentType<NodeProps>,
});

registerCardType({
  type: "youtube",
  label: "YouTube",
  creatable: true,
  createMode: "source",
  defaultSize: YOUTUBE_DEFAULT_SIZE,
  Node: YoutubeCardNode as ComponentType<NodeProps>,
});

registerCardType({
  type: "article",
  label: "Article",
  creatable: true,
  createMode: "source",
  defaultSize: SOURCE_LINK_DEFAULT_SIZE,
  Node: ArticleCardNode as ComponentType<NodeProps>,
});

registerCardType({
  type: "web",
  label: "Web",
  creatable: true,
  createMode: "source",
  defaultSize: SOURCE_LINK_DEFAULT_SIZE,
  Node: WebCardNode as ComponentType<NodeProps>,
});

registerCardType({
  type: "news",
  label: "News",
  creatable: false,
  createMode: "source",
  defaultSize: SOURCE_LINK_DEFAULT_SIZE,
  Node: NewsCardNode as ComponentType<NodeProps>,
});

registerCardType({
  type: "x",
  label: "X",
  creatable: false,
  createMode: "source",
  defaultSize: SOURCE_LINK_DEFAULT_SIZE,
  Node: XCardNode as ComponentType<NodeProps>,
});
