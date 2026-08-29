"use client";

import type { Node, NodeProps } from "@xyflow/react";
import type { Card } from "@openbento/domain";
import { SourceCardChrome } from "@/components/cards/SourceCardChrome";
import { SafeExternalLink } from "@/components/cards/SafeExternalLink";
import { UntrustedText } from "@/components/cards/UntrustedText";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { knownPublishedAtLabel } from "@/lib/domain/source-card";
import { hostnameFromHttpUrl, sanitizeUntrustedDisplayText } from "@/lib/untrusted";

export type ArticleNode = Node<{ cardId: string }, "article">;
export type WebNode = Node<{ cardId: string }, "web">;

function SourceLinkBody({
  card,
  selected,
  label,
}: {
  card: Extract<Card, { type: "article" | "web" }>;
  selected: boolean;
  label: string;
}) {
  const provenance = card.payload.provenance;
  const host = hostnameFromHttpUrl(provenance.sourceUrl);
  const author = sanitizeUntrustedDisplayText(provenance.author ?? "", 120);
  const published = knownPublishedAtLabel(provenance.publishedAt);

  return (
    <SourceCardChrome
      card={card}
      selected={selected}
      label={label}
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
        <SafeExternalLink
          href={provenance.sourceUrl}
          className="nodrag nopan truncate text-[11px] text-indigo-300 hover:text-indigo-200"
        />
        {author || published ? (
          <p className="text-[11px] text-zinc-500">
            {author ? <UntrustedText value={author} /> : null}
            {author && published ? " · " : null}
            {published ? <UntrustedText value={published} /> : null}
          </p>
        ) : null}
      </div>
    </SourceCardChrome>
  );
}

export function ArticleCardNode({ data, selected }: NodeProps<ArticleNode>) {
  const { snapshot } = useWorkspace();
  const card = snapshot.cards.find((entry) => entry.id === data.cardId);
  if (!card || card.type !== "article") {
    return null;
  }
  return <SourceLinkBody card={card} selected={selected} label="Article" />;
}

export function WebCardNode({ data, selected }: NodeProps<WebNode>) {
  const { snapshot } = useWorkspace();
  const card = snapshot.cards.find((entry) => entry.id === data.cardId);
  if (!card || card.type !== "web") {
    return null;
  }
  return <SourceLinkBody card={card} selected={selected} label="Web" />;
}
