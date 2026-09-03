"use client";

import type { Card, XCardMedia, XCardMetrics } from "@openbento/domain";
import type { Node, NodeProps } from "@xyflow/react";
import { BarChart3, Heart, MessageCircle, Repeat2 } from "lucide-react";
import type { ReactNode } from "react";
import { SafeExternalLink } from "@/components/cards/SafeExternalLink";
import { SourceCardChrome } from "@/components/cards/SourceCardChrome";
import { UntrustedText } from "@/components/cards/UntrustedText";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { provenanceDisplay } from "@/lib/canvas/provenance-display";
import {
  safeXMediaUrl,
  sanitizeUntrustedDisplayText,
} from "@/lib/untrusted";
import { cn } from "@/lib/utils";

export type XNode = Node<{ cardId: string }, "x">;
export type XCard = Extract<Card, { type: "x" }>;

/** Resolve only a persisted X Card; never coerce another source type. */
export function xCardForNode(
  cards: readonly Card[],
  cardId: string,
): XCard | null {
  const card = cards.find((entry) => entry.id === cardId);
  return card?.type === "x" ? card : null;
}

export function compactXTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

export function compactMetric(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | undefined;
  icon: ReactNode;
}) {
  if (value === undefined) {
    return null;
  }
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${label}: ${value}`}>
      {icon}
      {compactMetric(value)}
    </span>
  );
}

function XMetrics({ metrics }: { metrics?: XCardMetrics }) {
  if (!metrics || Object.values(metrics).every((value) => value === undefined)) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
      <Metric label="Replies" value={metrics.replyCount} icon={<MessageCircle size={12} />} />
      <Metric label="Reposts" value={metrics.repostCount} icon={<Repeat2 size={12} />} />
      <Metric label="Likes" value={metrics.likeCount} icon={<Heart size={12} />} />
      <Metric label="Views" value={metrics.viewCount} icon={<BarChart3 size={12} />} />
    </div>
  );
}

export function safeRenderableXMedia(media: readonly XCardMedia[]): XCardMedia[] {
  const safe: XCardMedia[] = [];
  for (const item of media) {
    if (safe.length === 4) {
      break;
    }
    const image = safeXMediaUrl(item.url ?? item.previewImageUrl, "image");
    const poster = safeXMediaUrl(item.previewImageUrl, "image");
    const playback = safeXMediaUrl(item.playbackUrl, "video");
    if (item.type === "photo" && image) {
      safe.push({ ...item, url: image });
      continue;
    }
    if ((item.type === "video" || item.type === "animated_gif") && (poster || playback)) {
      safe.push({
        mediaKey: item.mediaKey,
        type: item.type,
        ...(item.width !== undefined ? { width: item.width } : {}),
        ...(item.height !== undefined ? { height: item.height } : {}),
        ...(item.durationMs !== undefined ? { durationMs: item.durationMs } : {}),
        ...(item.altText !== undefined ? { altText: item.altText } : {}),
        ...(item.viewCount !== undefined ? { viewCount: item.viewCount } : {}),
        ...(poster ? { previewImageUrl: poster } : {}),
        ...(playback ? { playbackUrl: playback } : {}),
      });
    }
  }
  return safe;
}

function XMediaTile({
  media,
  crop,
}: {
  media: XCardMedia;
  crop: boolean;
}) {
  const alt = sanitizeUntrustedDisplayText(media.altText ?? "X post media", 1_000);
  if (media.type !== "photo" && media.playbackUrl) {
    return (
      <video
        className="nodrag nopan nowheel h-full w-full bg-black object-contain"
        src={media.playbackUrl}
        poster={media.previewImageUrl}
        aria-label={alt || "X post video"}
        controls
        playsInline
        preload="metadata"
      />
    );
  }
  const image = media.type === "photo" ? media.url : media.previewImageUrl;
  return image ? (
    // Provider-owned media is intentionally loaded directly after strict host validation.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={cn("h-full w-full", crop ? "object-cover" : "object-contain")}
      src={image}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : null;
}

function XMediaGrid({ media }: { media: readonly XCardMedia[] }) {
  const items = safeRenderableXMedia(media);
  if (items.length === 0) {
    return null;
  }
  return (
    <div
      data-x-media-count={items.length}
      className={cn(
        "grid min-h-24 flex-1 overflow-hidden rounded-lg border border-white/10 bg-black/40",
        items.length === 1 ? "grid-cols-1" : "grid-cols-2",
        items.length <= 2 ? "grid-rows-1" : "grid-rows-2",
      )}
    >
      {items.map((item, index) => (
        <div
          key={item.mediaKey}
          className={cn(
            "min-h-0 overflow-hidden border-white/10",
            index > 0 && "border-l",
            items.length > 2 && index > 1 && "border-t",
            items.length === 3 && index === 0 && "row-span-2",
          )}
        >
          <XMediaTile media={item} crop={items.length > 1} />
        </div>
      ))}
    </div>
  );
}

export function XCardBody({ card }: { card: XCard }) {
  const { payload } = card;
  const provenance = payload.provenance;
  const displayName = sanitizeUntrustedDisplayText(
    payload.authorDisplayName ?? provenance.author ?? "X post",
    200,
  );
  const username = sanitizeUntrustedDisplayText(
    payload.username ?? provenance.author ?? "",
    15,
  );
  const avatar = safeXMediaUrl(payload.authorAvatarUrl, "image");
  const timestamp = compactXTimestamp(provenance.publishedAt);
  const provenanceMeta = provenanceDisplay(card);

  return (
    <div className="nowheel flex h-full min-h-0 flex-col gap-2 overflow-y-auto pr-0.5">
      <div className="flex min-w-0 items-center gap-2">
        {avatar ? (
          // X avatars are remote, optional, and validated before reaching this element.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="h-8 w-8 shrink-0 rounded-full bg-zinc-800 object-cover"
            src={avatar}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">
            X
          </span>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <UntrustedText value={displayName} className="block truncate text-xs font-semibold text-zinc-100" />
          <div className="flex min-w-0 items-center gap-1 text-[11px] text-zinc-500">
            {username ? <span className="truncate">@{username}</span> : null}
            {username && timestamp ? <span>·</span> : null}
            {timestamp ? <span className="shrink-0">{timestamp} UTC</span> : null}
          </div>
        </div>
        <span className="shrink-0 text-xs font-semibold text-zinc-500">X</span>
      </div>

      <UntrustedText
        as="p"
        value={payload.postText ?? provenance.title}
        className="whitespace-pre-wrap text-[13px] leading-[1.35rem] text-zinc-100"
      />
      <XMediaGrid media={payload.media ?? []} />
      <XMetrics metrics={payload.metrics} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-600">
        {provenanceMeta?.discoveredAt ? (
          <span>Discovered {provenanceMeta.discoveredAt}</span>
        ) : <span />}
        <SafeExternalLink
          href={provenance.sourceUrl}
          className="nodrag nopan font-medium text-indigo-300 hover:text-indigo-200"
        >
          Open on X ↗
        </SafeExternalLink>
      </div>
    </div>
  );
}

export function XCardNode({ data, selected }: NodeProps<XNode>) {
  const { snapshot } = useWorkspace();
  const card = xCardForNode(snapshot.cards, data.cardId);
  if (!card) {
    return null;
  }
  return (
    <SourceCardChrome
      card={card}
      selected={selected}
      label="X"
      minWidth={240}
      minHeight={160}
    >
      <XCardBody card={card} />
    </SourceCardChrome>
  );
}
