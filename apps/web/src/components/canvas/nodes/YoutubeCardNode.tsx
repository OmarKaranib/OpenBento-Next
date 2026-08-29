"use client";

import type { Node, NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SourceCardChrome } from "@/components/cards/SourceCardChrome";
import { SafeExternalLink } from "@/components/cards/SafeExternalLink";
import { UntrustedText } from "@/components/cards/UntrustedText";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import {
  acquireYoutubeEmbedSlot,
  releaseYoutubeEmbedSlot,
  subscribeYoutubeEmbedSlots,
} from "@/lib/youtube-embed-slots";
import { knownPublishedAtLabel } from "@/lib/domain/source-card";
import { sanitizeUntrustedDisplayText } from "@/lib/untrusted";
import {
  isYouTubeVideoId,
  officialYouTubeEmbedUrl,
  parseYouTubeVideoId,
} from "@/lib/youtube";

export type YoutubeNode = Node<{ cardId: string }, "youtube">;

export function YoutubeCardNode({ data, selected }: NodeProps<YoutubeNode>) {
  const { snapshot } = useWorkspace();
  const card = snapshot.cards.find((entry) => entry.id === data.cardId);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(true);
  const [wantsPlay, setWantsPlay] = useState(false);
  const [liveIds, setLiveIds] = useState<readonly string[]>([]);

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

  useEffect(() => {
    if (!card || card.type !== "youtube") {
      return;
    }
    if (wantsPlay && inView) {
      acquireYoutubeEmbedSlot(card.id);
      return () => {
        releaseYoutubeEmbedSlot(card.id);
      };
    }
    releaseYoutubeEmbedSlot(card.id);
    return undefined;
  }, [card, inView, wantsPlay]);

  if (!card || card.type !== "youtube") {
    return null;
  }

  const provenance = card.payload.provenance;
  const videoId =
    parseYouTubeVideoId(provenance.sourceUrl) ??
    (isYouTubeVideoId(provenance.externalId) ? provenance.externalId : null);
  const embedSrc = videoId ? officialYouTubeEmbedUrl(videoId) : null;
  const iframeTitle = sanitizeUntrustedDisplayText(provenance.title) || "YouTube";
  const published = knownPublishedAtLabel(provenance.publishedAt);
  const mounted = Boolean(
    wantsPlay && inView && embedSrc && liveIds.includes(card.id),
  );

  return (
    <div ref={rootRef} className="h-full w-full">
      <SourceCardChrome
        card={card}
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
          <div className="relative min-h-[7.5rem] flex-1 overflow-hidden rounded-md bg-zinc-950">
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
                className="nodrag nopan flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                onClick={() => {
                  if (embedSrc) {
                    setInView(true);
                    setWantsPlay(true);
                  }
                }}
                disabled={!embedSrc}
              >
                <Play className="h-8 w-8" strokeWidth={1.5} />
                <span className="text-[11px]">
                  {embedSrc ? "Play official embed" : "Invalid YouTube URL"}
                </span>
              </button>
            )}
          </div>
          <SafeExternalLink
            href={provenance.sourceUrl}
            className="nodrag nopan shrink-0 truncate text-[11px] text-indigo-300 hover:text-indigo-200"
          />
          {published ? (
            <UntrustedText
              value={published}
              className="shrink-0 text-[11px] text-zinc-500"
            />
          ) : null}
        </div>
      </SourceCardChrome>
    </div>
  );
}
