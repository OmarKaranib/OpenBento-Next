"use client";

import type { Node, NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CardNodeResizer } from "@/components/cards/CardNodeResizer";
import { NewCardBadge } from "@/components/cards/NewCardBadge";
import { WatchBotAttribution } from "@/components/cards/WatchBotAttribution";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useCanvasMonitorOptional } from "@/components/workspace/canvas-monitor";
import { cardWatchBotId } from "@/lib/canvas/watchbot-attribution";
import {
  acquireYoutubeEmbedSlot,
  releaseYoutubeEmbedSlot,
  subscribeYoutubeEmbedSlots,
} from "@/lib/youtube-embed-slots";
import { sanitizeUntrustedDisplayText } from "@/lib/untrusted";
import {
  isYouTubeVideoId,
  officialYouTubeEmbedUrl,
  officialYouTubeThumbnailUrl,
  parseYouTubeVideoId,
} from "@/lib/youtube";

export type YoutubeNode = Node<
  { cardId: string; parked?: boolean },
  "youtube"
>;

export function YoutubeCardNode({ data, selected }: NodeProps<YoutubeNode>) {
  const { snapshot } = useWorkspace();
  const monitor = useCanvasMonitorOptional();
  const card = snapshot.cards.find((entry) => entry.id === data.cardId);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(true);
  const [liveIds, setLiveIds] = useState<readonly string[]>([]);
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null);

  useEffect(() => subscribeYoutubeEmbedSlots(setLiveIds), []);
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const youtubeCard = card?.type === "youtube" ? card : null;
  const provenance = youtubeCard?.payload.provenance;
  const videoId =
    (provenance && parseYouTubeVideoId(provenance.sourceUrl)) ??
    (provenance && isYouTubeVideoId(provenance.externalId)
      ? provenance.externalId
      : null);
  const embedSrc = videoId ? officialYouTubeEmbedUrl(videoId) : null;
  const thumbnailSrc = videoId ? officialYouTubeThumbnailUrl(videoId) : null;
  const iframeTitle = sanitizeUntrustedDisplayText(provenance?.title) || "YouTube";
  const parked = Boolean(data.parked);
  const mounted = Boolean(
    youtubeCard && !parked && inView && embedSrc && liveIds.includes(youtubeCard.id),
  );

  useEffect(() => {
    if ((!inView || parked) && youtubeCard) releaseYoutubeEmbedSlot(youtubeCard.id);
  }, [inView, parked, youtubeCard]);
  useEffect(() => {
    const cardId = youtubeCard?.id;
    return () => {
      if (cardId) releaseYoutubeEmbedSlot(cardId);
    };
  }, [youtubeCard?.id]);

  if (!youtubeCard || !provenance) return null;

  const watchBotId = cardWatchBotId(youtubeCard);
  const isNew = monitor?.isCardNew(youtubeCard.id) ?? false;

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-visible"
      style={{ minWidth: 240, minHeight: 180 }}
    >
      <CardNodeResizer
        card={youtubeCard}
        selected={selected}
        minWidth={240}
        minHeight={180}
      />
      <div
        data-card-visual-shell
        data-media-first
        className={`group relative h-full w-full overflow-hidden rounded-xl border bg-black shadow-[0_8px_24px_rgba(0,0,0,0.45)] ${
          isNew ? "border-indigo-400/80 ring-1 ring-indigo-400/60" : "border-[#2a3140]"
        } ${parked ? "opacity-45 grayscale" : ""}`}
      >
        {mounted && embedSrc ? (
          <iframe
            src={embedSrc}
            title={iframeTitle}
            data-card-interactive
            className="nodrag nopan nowheel absolute inset-0 h-full w-full aspect-video border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            data-card-interactive
            className="nodrag nopan relative flex h-full w-full aspect-video items-center justify-center overflow-hidden"
            onClick={() => {
              if (!parked && embedSrc) acquireYoutubeEmbedSlot(youtubeCard.id);
            }}
            disabled={parked || !embedSrc}
          >
            {thumbnailSrc && failedThumbnail !== thumbnailSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- fixed official thumbnail URL.
              <img
                src={thumbnailSrc}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={() => setFailedThumbnail(thumbnailSrc)}
              />
            ) : null}
            <span className="absolute inset-0 bg-black/35 transition-colors group-hover:bg-black/20" />
            <span className="relative rounded-full bg-red-600/95 p-3 text-white shadow-xl">
              <Play className="h-7 w-7 fill-current" strokeWidth={1.5} />
            </span>
            <span className="sr-only">
              {embedSrc ? "Play official embed" : "Invalid YouTube URL"}
            </span>
          </button>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/65 to-transparent px-3 pb-3 pt-14">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold leading-5 text-white">
                {sanitizeUntrustedDisplayText(provenance.title, 240)}
              </p>
              <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-zinc-300">
                <span>YouTube</span>
                {isNew ? <NewCardBadge /> : null}
              </div>
            </div>
            {watchBotId ? (
              <div
                data-watchbot-id={watchBotId}
                className="shrink-0 rounded bg-black/55 px-2 py-1 normal-case"
              >
                <WatchBotAttribution
                  watchBotId={watchBotId}
                  watchBots={snapshot.watchBots}
                />
              </div>
            ) : null}
          </div>
        </div>
        {videoId && !parked ? (
          <a
            href={provenance.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            data-provenance={provenance.sourceUrl}
            aria-label="Open video on YouTube"
            className="nodrag nopan absolute left-2 top-2 rounded bg-black/65 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          >
            Open on YouTube
          </a>
        ) : null}
        {parked ? (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-end bg-black/30 p-2">
            <span className="rounded bg-black/75 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-200">
              Parked
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
