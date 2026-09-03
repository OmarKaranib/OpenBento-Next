"use client";

import type { Node, NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SourceCardChrome } from "@/components/cards/SourceCardChrome";
import { SourceProvenanceMeta } from "@/components/cards/SourceProvenanceMeta";
import { UntrustedText } from "@/components/cards/UntrustedText";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import {
  acquireYoutubeEmbedSlot,
  releaseYoutubeEmbedSlot,
  subscribeYoutubeEmbedSlots,
  tryAcquireYoutubeEmbedSlot,
} from "@/lib/youtube-embed-slots";
import { sanitizeUntrustedDisplayText } from "@/lib/untrusted";
import {
  isYouTubeVideoId,
  officialYouTubeAutoplayEmbedUrl,
  officialYouTubeThumbnailUrl,
  parseYouTubeVideoId,
} from "@/lib/youtube";

export type YoutubeNode = Node<{ cardId: string }, "youtube">;

export function YoutubeCardNode({ data, selected }: NodeProps<YoutubeNode>) {
  const { snapshot } = useWorkspace();
  const card = snapshot.cards.find((entry) => entry.id === data.cardId);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(true);
  const [liveIds, setLiveIds] = useState<readonly string[]>([]);
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null);

  useEffect(() => {
    return subscribeYoutubeEmbedSlots(setLiveIds);
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(Boolean(entry?.isIntersecting));
      },
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
  const embedSrc = videoId ? officialYouTubeAutoplayEmbedUrl(videoId) : null;
  const thumbnailSrc = videoId ? officialYouTubeThumbnailUrl(videoId) : null;
  const iframeTitle = sanitizeUntrustedDisplayText(provenance?.title) || "YouTube";
  const mounted = Boolean(
    youtubeCard && inView && embedSrc && liveIds.includes(youtubeCard.id),
  );

  // Visible Cards acquire only spare slots, preserving current automatic
  // players. A deliberate click uses the promoting allocator below.
  useEffect(() => {
    if (!youtubeCard || !videoId || !inView) {
      if (youtubeCard) {
        releaseYoutubeEmbedSlot(youtubeCard.id);
      }
      return;
    }
    if (!liveIds.includes(youtubeCard.id)) {
      tryAcquireYoutubeEmbedSlot(youtubeCard.id);
    }
  }, [inView, liveIds, videoId, youtubeCard]);

  useEffect(() => {
    const cardId = youtubeCard?.id;
    return () => {
      if (cardId) {
        releaseYoutubeEmbedSlot(cardId);
      }
    };
  }, [youtubeCard?.id]);

  if (!youtubeCard || !provenance) {
    return null;
  }

  return (
    <div ref={rootRef} className="h-full w-full">
      <SourceCardChrome
        card={youtubeCard}
        selected={selected}
        label="YouTube"
        minWidth={240}
        minHeight={180}
      >
        <div className="flex h-full min-h-0 flex-col gap-2">
          <UntrustedText
            value={provenance.title}
            className="shrink-0 text-sm font-medium leading-5 text-zinc-100"
          />
          <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-md bg-zinc-950">
            {mounted && embedSrc ? (
              <iframe
                src={embedSrc}
                title={iframeTitle}
                className="nodrag nopan nowheel absolute inset-0 h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <button
                type="button"
                className="nodrag nopan group relative flex h-full w-full items-center justify-center overflow-hidden text-zinc-300"
                onClick={() => {
                  if (embedSrc) {
                    setInView(true);
                    acquireYoutubeEmbedSlot(youtubeCard.id);
                  }
                }}
                disabled={!embedSrc}
              >
                {thumbnailSrc && failedThumbnail !== thumbnailSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element -- fixed official thumbnail URL; Next Image would require host configuration.
                  <img
                    src={thumbnailSrc}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={() => setFailedThumbnail(thumbnailSrc)}
                  />
                ) : null}
                <span className="absolute inset-0 bg-black/55 transition-colors group-hover:bg-black/40" />
                <span className="relative flex flex-col items-center gap-2">
                  <span className="rounded-full border border-white/40 bg-black/50 p-3 text-white shadow-lg">
                    <Play className="h-7 w-7 fill-current" strokeWidth={1.5} />
                  </span>
                  <span className="text-[11px] text-zinc-200">
                    {embedSrc ? "Play official embed" : "Invalid YouTube URL"}
                  </span>
                </span>
              </button>
            )}
          </div>
          <SourceProvenanceMeta card={youtubeCard} />
        </div>
      </SourceCardChrome>
    </div>
  );
}
