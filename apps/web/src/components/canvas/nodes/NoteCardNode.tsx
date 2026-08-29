"use client";

import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useCanvasCommands } from "@/components/canvas/use-canvas-commands";

export type NoteNode = Node<{ cardId: string }, "note">;

export function NoteCardNode({ data, selected }: NodeProps<NoteNode>) {
  const { snapshot, execute } = useWorkspace();
  const { persistCardGeometry } = useCanvasCommands();
  const card = snapshot.cards.find((entry) => entry.id === data.cardId);
  const readOnly = Boolean(snapshot.fullscreen?.active);
  const text = card && card.type === "note" ? card.payload.text : "";
  const [draft, setDraft] = useState<string | null>(null);

  if (!card || card.type !== "note") {
    return null;
  }

  return (
    <div
      className="relative h-full w-full rounded-xl border border-[#2a3140] bg-[#161a22] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      style={{ minWidth: 160, minHeight: 100 }}
    >
      <NodeResizer
        isVisible={selected && !readOnly}
        minWidth={160}
        minHeight={100}
        color="#64748b"
        onResizeEnd={(_event, params) => {
          persistCardGeometry(card, {
            size: { width: params.width, height: params.height },
          });
        }}
      />
      <div className="flex h-7 items-center px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
        Note
      </div>
      <textarea
        className="nodrag nowheel nopan h-[calc(100%-1.75rem)] w-full resize-none bg-transparent px-3 pb-3 text-sm leading-5 text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
        value={draft ?? text}
        readOnly={readOnly}
        placeholder="Write a note…"
        onFocus={() => setDraft(text)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const next = draft ?? text;
          setDraft(null);
          if (readOnly || next === card.payload.text) {
            return;
          }
          execute("updateCard", {
            cardId: card.id,
            type: "note",
            payload: { text: next },
          });
        }}
      />
    </div>
  );
}
