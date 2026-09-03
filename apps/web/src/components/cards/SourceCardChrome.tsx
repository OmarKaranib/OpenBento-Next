"use client";

import type { Card } from "@openbento/domain";
import { CardNodeResizer } from "@/components/cards/CardNodeResizer";
import { NewCardBadge } from "@/components/cards/NewCardBadge";
import { WatchBotAttribution } from "@/components/cards/WatchBotAttribution";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useCanvasMonitorOptional } from "@/components/workspace/canvas-monitor";
import { cardWatchBotId } from "@/lib/canvas/watchbot-attribution";
import { sourceKindLabel } from "@/lib/canvas/provenance-display";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SourceCardChrome({
  card,
  selected,
  label,
  children,
  minWidth,
  minHeight,
}: {
  card: Card;
  selected: boolean;
  label?: string;
  children: ReactNode;
  minWidth: number;
  minHeight: number;
}) {
  const { snapshot } = useWorkspace();
  const monitor = useCanvasMonitorOptional();
  const isNew = monitor?.isCardNew(card.id) ?? false;
  const kind = label ?? sourceKindLabel(card) ?? "Source";
  const watchBotId = cardWatchBotId(card);

  return (
    <div
      className="relative h-full w-full overflow-visible"
      style={{ minWidth, minHeight }}
    >
      <CardNodeResizer
        card={card}
        selected={selected}
        minWidth={minWidth}
        minHeight={minHeight}
      />
      <div
        data-card-visual-shell
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-xl border border-[#2a3140] bg-[#161a22] shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
          isNew && "ring-1 ring-indigo-400/70",
        )}
      >
        <div className="flex h-7 shrink-0 items-center gap-2 px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          <span>{kind}</span>
          {isNew ? <NewCardBadge /> : null}
        </div>
        {watchBotId ? (
          <div className="shrink-0 px-3 pb-1 normal-case tracking-normal">
            <WatchBotAttribution
              watchBotId={watchBotId}
              watchBots={snapshot.watchBots}
            />
          </div>
        ) : null}
        <div className="min-h-0 flex-1 px-3 pb-3">{children}</div>
      </div>
    </div>
  );
}
