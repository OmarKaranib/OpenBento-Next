"use client";

import type { Node, NodeProps } from "@xyflow/react";
import type { Card } from "@openbento/domain";
import { SourceCardChrome } from "@/components/cards/SourceCardChrome";
import { SourceProvenanceMeta } from "@/components/cards/SourceProvenanceMeta";
import { UntrustedText } from "@/components/cards/UntrustedText";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { sourceKindLabel } from "@/lib/canvas/provenance-display";
import { hostnameFromHttpUrl, sanitizeUntrustedDisplayText } from "@/lib/untrusted";

export type ArticleNode = Node<{ cardId: string }, "article">;
export type WebNode = Node<{ cardId: string }, "web">;
export type XNode = Node<{ cardId: string }, "x">;
export type NewsNode = Node<{ cardId: string }, "news">;

type SourceLinkCard = Extract<Card, { type: "article" | "web" | "x" | "news" }>;

/** Resolves a persisted sourced Card without coercing its discriminated type. */
export function sourceLinkCardForNode<T extends SourceLinkCard["type"]>(
  cards: readonly Card[],
  cardId: string,
  type: T,
): Extract<SourceLinkCard, { type: T }> | null {
  const card = cards.find((entry) => entry.id === cardId);
  return card?.type === type
    ? (card as Extract<SourceLinkCard, { type: T }>)
    : null;
}

function SourceLinkBody({
  card,
  selected,
  label,
}: {
  card: SourceLinkCard;
  selected: boolean;
  label?: string;
}) {
  const provenance = card.payload.provenance;
  const host = hostnameFromHttpUrl(provenance.sourceUrl);
  const author = sanitizeUntrustedDisplayText(provenance.author ?? "", 120);
  const kind = label ?? sourceKindLabel(card) ?? "Source";

  return (
    <SourceCardChrome
      card={card}
      selected={selected}
      label={kind}
      minWidth={200}
      minHeight={120}
    >
      <div className="flex h-full min-h-0 flex-col gap-1.5">
        <UntrustedText
          value={provenance.title}
          className="text-sm font-medium leading-5 text-zinc-100"
        />
        {host ? (
          <UntrustedText value={host} className="text-[11px] text-zinc-500" />
        ) : null}
        <SourceProvenanceMeta card={card} author={author} />
      </div>
    </SourceCardChrome>
  );
}

export function ArticleCardNode({ data, selected }: NodeProps<ArticleNode>) {
  const { snapshot } = useWorkspace();
  const card = sourceLinkCardForNode(snapshot.cards, data.cardId, "article");
  if (!card) {
    return null;
  }
  return <SourceLinkBody card={card} selected={selected} label="Article" />;
}

export function WebCardNode({ data, selected }: NodeProps<WebNode>) {
  const { snapshot } = useWorkspace();
  const card = sourceLinkCardForNode(snapshot.cards, data.cardId, "web");
  if (!card) {
    return null;
  }
  return <SourceLinkBody card={card} selected={selected} label="Web" />;
}

export function XCardNode({ data, selected }: NodeProps<XNode>) {
  const { snapshot } = useWorkspace();
  const card = sourceLinkCardForNode(snapshot.cards, data.cardId, "x");
  if (!card) {
    return null;
  }
  return <SourceLinkBody card={card} selected={selected} label="X" />;
}

export function NewsCardNode({ data, selected }: NodeProps<NewsNode>) {
  const { snapshot } = useWorkspace();
  const card = sourceLinkCardForNode(snapshot.cards, data.cardId, "news");
  if (!card) {
    return null;
  }
  return <SourceLinkBody card={card} selected={selected} label="News" />;
}
