"use client";

import { type Node, type NodeProps } from "@xyflow/react";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { NewCardBadge } from "@/components/cards/NewCardBadge";
import { useCanvasMonitorOptional } from "@/components/workspace/canvas-monitor";
import { cn } from "@/lib/utils";
import { CardNodeResizer } from "@/components/cards/CardNodeResizer";

export type NoteNode = Node<{ cardId: string; parked?: boolean }, "note">;

export function NoteCardNode({ data, selected }: NodeProps<NoteNode>) {
  const { session, snapshot, execute } = useWorkspace();
  const card = snapshot.cards.find((entry) => entry.id === data.cardId);
  const readOnly = Boolean(data.parked);
  const monitor = useCanvasMonitorOptional();
  const text = card && card.type === "note" ? card.payload.text : "";
  const [draft, setDraft] = useState<string | null>(null);
  const isNew = card ? (monitor?.isCardNew(card.id) ?? false) : false;

  if (!card || card.type !== "note") {
    return null;
  }

  return (
    <div
      className="relative h-full w-full overflow-visible"
      style={{ minWidth: 160, minHeight: 100 }}
    >
      <CardNodeResizer
        card={card}
        selected={selected}
        minWidth={160}
        minHeight={100}
      />
      <div
        data-card-visual-shell
        className={cn(
          "h-full w-full overflow-hidden rounded-xl border border-[#2a3140] bg-[#161a22] shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
          isNew && "ring-1 ring-indigo-400/70",
          readOnly && "opacity-45 grayscale",
        )}
      >
        <div className="flex h-7 items-center gap-2 px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          <span>Note</span>
          {isNew ? <NewCardBadge /> : null}
        </div>
        <textarea
          className={cn(
            "nodrag nowheel nopan h-[calc(100%-1.75rem)] w-full resize-none bg-transparent px-3 pb-3 text-sm leading-5 text-zinc-100 placeholder:text-zinc-600 focus:outline-none",
            readOnly && "pointer-events-none select-none",
          )}
          value={draft ?? text}
          readOnly={readOnly}
          placeholder="Write a note…"
          onFocus={() => {
            session.beginInteraction();
            setDraft(text);
          }}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const next = draft ?? text;
            setDraft(null);
            const persist =
              !readOnly && next !== card.payload.text
                ? execute("updateCard", {
                    cardId: card.id,
                    type: "note",
                    payload: { text: next },
                  })
                : Promise.resolve();
            void persist.finally(() => {
              void session.endInteraction();
            });
          }}
        />
      </div>
    </div>
  );
}
