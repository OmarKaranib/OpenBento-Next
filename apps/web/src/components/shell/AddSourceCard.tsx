"use client";

import { FileText, Globe, Youtube } from "lucide-react";
import { useState } from "react";
import type { CreatableSourceCardType } from "@/lib/domain/source-card";
import { buildCreateSourceCardInput } from "@/lib/domain/source-card";
import { getCardType, listCreatableCardTypes } from "@/components/cards/registry";
import { useCanvasCommands } from "@/components/canvas/use-canvas-commands";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ICONS: Record<CreatableSourceCardType, typeof Youtube> = {
  youtube: Youtube,
  article: FileText,
  web: Globe,
};

function nextCardPosition(index: number): { x: number; y: number } {
  return {
    x: 80 + index * 24,
    y: 80 + index * 16,
  };
}

function AddSourceCardButton({ type }: { type: CreatableSourceCardType }) {
  const module = getCardType(type);
  const { snapshot } = useWorkspace();
  const { persistCreatedCard } = useCanvasCommands();
  const [open, setOpen] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canvasId = snapshot.currentCanvasId;
  const Icon = ICONS[type];

  if (!module) {
    return null;
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
        >
          <Icon className="h-3.5 w-3.5" />
          {module.label}
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" className="w-80">
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canvasId) {
              setError("Create a Canvas first");
              return;
            }
            try {
              const input = buildCreateSourceCardInput({
                canvasId,
                type,
                sourceUrl,
                title,
                position: nextCardPosition(snapshot.cards.length),
                size: module.defaultSize,
              });
              void persistCreatedCard(input);
              setSourceUrl("");
              setTitle("");
              setError(null);
              setOpen(false);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Could not create Card");
            }
          }}
        >
          <p className="text-xs font-medium text-zinc-300">Add {module.label}</p>
          <Input
            required
            type="url"
            name="sourceUrl"
            placeholder={
              type === "youtube"
                ? "https://www.youtube.com/watch?v=…"
                : "https://example.com/story"
            }
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            aria-label={`${module.label} URL`}
          />
          <Input
            type="text"
            name="title"
            placeholder="Title (optional)"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label={`${module.label} title`}
          />
          {error ? <p className="text-[11px] text-red-400">{error}</p> : null}
          <Button type="submit" size="sm">
            Add to Canvas
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function AddSourceCards() {
  const sourceTypes = listCreatableCardTypes().filter(
    (entry) => entry.createMode === "source",
  );

  return (
    <>
      {sourceTypes.map((entry) => {
        if (
          entry.type !== "youtube" &&
          entry.type !== "article" &&
          entry.type !== "web"
        ) {
          return null;
        }
        return <AddSourceCardButton key={entry.type} type={entry.type} />;
      })}
    </>
  );
}
