"use client";

import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import {
  orderColumnCardsNewestFirst,
  type Card,
} from "@openbento/domain";
import { GripVertical, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { XCardContent } from "@/components/cards/XCardContent";
import { useCanvasCommands } from "@/components/canvas/use-canvas-commands";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { cardSourceHref } from "@/lib/canvas/context-menu";
import {
  acquireYoutubeEmbedSlot,
  releaseYoutubeEmbedSlot,
  subscribeYoutubeEmbedSlots,
} from "@/lib/youtube-embed-slots";
import {
  officialYouTubeEmbedUrl,
  officialYouTubeThumbnailUrl,
  parseYouTubeVideoId,
} from "@/lib/youtube";
import { sanitizeUntrustedDisplayText } from "@/lib/untrusted";

export const COLUMN_CARD_DRAG_TYPE = "application/x-openbento-column-card";

export type ColumnFlowNode = Node<
  { columnId: string; parked?: boolean },
  "column"
>;

export function setColumnCardDragData(
  dataTransfer: Pick<DataTransfer, "effectAllowed" | "setData">,
  cardId: string,
): void {
  dataTransfer.effectAllowed = "move";
  dataTransfer.setData(COLUMN_CARD_DRAG_TYPE, cardId);
  dataTransfer.setData("text/plain", cardId);
}

function ColumnCardTile({ card, parked }: { card: Card; parked: boolean }) {
  const [liveIds, setLiveIds] = useState<readonly string[]>([]);
  useEffect(() => subscribeYoutubeEmbedSlots(setLiveIds), []);
  useEffect(
    () => () => {
      releaseYoutubeEmbedSlot(card.id);
    },
    [card.id],
  );

  const provenance = "provenance" in card.payload ? card.payload.provenance : null;
  const title =
    card.type === "note"
      ? card.payload.text
      : provenance?.title || card.type.replaceAll("_", " ");
  const href = cardSourceHref(card);
  const videoId =
    card.type === "youtube" && provenance
      ? parseYouTubeVideoId(provenance.sourceUrl)
      : null;
  const mounted = Boolean(videoId && liveIds.includes(card.id) && !parked);

  return (
    <article
      data-column-card-id={card.id}
      data-card-interactive
      className="group/card relative shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#11151c] shadow-sm"
    >
      {card.type === "x" ? (
        <XCardContent card={card} variant="column" />
      ) : videoId ? (
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          {mounted ? (
            <iframe
              src={officialYouTubeEmbedUrl(videoId)}
              title={sanitizeUntrustedDisplayText(title) || "YouTube"}
              className="nodrag nopan nowheel absolute inset-0 h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <button
              type="button"
              disabled={parked}
              className="nodrag nopan relative flex h-full w-full items-center justify-center"
              onClick={() => acquireYoutubeEmbedSlot(card.id)}
              aria-label={`Play ${sanitizeUntrustedDisplayText(title)}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- bounded official thumbnail URL. */}
              <img
                src={officialYouTubeThumbnailUrl(videoId)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span className="absolute inset-0 bg-black/35" />
              <span className="relative rounded-full bg-red-600/95 p-2.5 text-white shadow-lg">
                <Play className="h-5 w-5 fill-current" />
              </span>
            </button>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-2 pt-8 text-xs font-medium text-white">
            {sanitizeUntrustedDisplayText(title, 180)}
          </div>
        </div>
      ) : (
        <div className="min-h-24 px-3 py-3 pr-8">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {card.type.replaceAll("_", " ")}
          </div>
          {href && !parked ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="nodrag nopan text-sm leading-5 text-zinc-100 hover:text-indigo-300"
            >
              {sanitizeUntrustedDisplayText(title, 260)}
            </a>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-5 text-zinc-200">
              {sanitizeUntrustedDisplayText(title, 260)}
            </p>
          )}
        </div>
      )}
      <button
        type="button"
        draggable={!parked}
        disabled={parked}
        data-column-card-drag-handle
        aria-label={`Drag ${sanitizeUntrustedDisplayText(title, 80)} out of Column`}
        title="Drag out to dashboard"
        className="nodrag nopan absolute right-1.5 top-1.5 z-20 flex h-7 w-7 cursor-grab items-center justify-center rounded-md border border-white/10 bg-black/65 text-white/75 shadow-sm hover:bg-black/85 hover:text-white active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
        onDragStart={(event) => {
          event.stopPropagation();
          setColumnCardDragData(event.dataTransfer, card.id);
        }}
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
    </article>
  );
}

export function ColumnNode({ data, selected }: NodeProps<ColumnFlowNode>) {
  const { session, snapshot, execute } = useWorkspace();
  const { persistColumnResize } = useCanvasCommands();
  const column = snapshot.columns.find((entry) => entry.id === data.columnId);
  const cards = orderColumnCardsNewestFirst(
    snapshot.cards.filter((card) => card.columnId === data.columnId),
  );
  const [name, setName] = useState<string | null>(null);
  const parked = Boolean(data.parked);

  if (!column) return null;

  return (
    <section
      data-column-id={column.id}
      data-column-parked={parked || undefined}
      className="relative flex h-full w-full flex-col overflow-visible rounded-xl border border-indigo-400/30 bg-[#171b24]/95 shadow-[0_14px_34px_rgba(0,0,0,0.42)]"
    >
      <NodeResizer
        isVisible={selected}
        minWidth={280}
        minHeight={320}
        color="#818cf8"
        onResizeStart={() => session.beginInteraction()}
        onResizeEnd={(_event, params) => {
          void persistColumnResize(column, {
            position: { x: params.x, y: params.y },
            size: { width: params.width, height: params.height },
          }).finally(() => void session.endInteraction());
        }}
      />
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <span className="h-2 w-2 rounded-full bg-indigo-400" />
        <input
          aria-label="Column name"
          className="nodrag nopan min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-100 outline-none"
          value={name ?? column.name}
          readOnly={parked}
          onFocus={() => {
            session.beginInteraction();
            setName(column.name);
          }}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            const next = (name ?? column.name).trim() || column.name;
            setName(null);
            const persist =
              !parked && next !== column.name
                ? execute("updateColumn", { columnId: column.id, name: next })
                : Promise.resolve();
            void persist.finally(() => void session.endInteraction());
          }}
        />
        <span className="text-[10px] tabular-nums text-zinc-500">{cards.length}</span>
      </header>
      <div
        className={`nodrag nopan nowheel min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-2 ${
          parked ? "pointer-events-none select-none" : ""
        }`}
      >
        {cards.length ? (
          cards.map((card) => (
            <ColumnCardTile key={card.id} card={card} parked={parked} />
          ))
        ) : (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-600">
            Cards arrive here newest first
          </div>
        )}
      </div>
      {parked ? (
        <div className="pointer-events-none absolute inset-0 flex items-end rounded-xl bg-black/35 p-3">
          <span className="rounded bg-black/75 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-300">
            Parked · delivery suspended
          </span>
        </div>
      ) : null}
    </section>
  );
}
