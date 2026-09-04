"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import type { AddCatalogEntry, AddCatalogId } from "@/lib/add-catalog";
import { ADD_CATALOG } from "@/lib/add-catalog";
import { dashboardFreeCardPosition } from "@/lib/canvas/dashboard-card-placement";
import { buildCreateNoteCardInput } from "@/lib/domain/note-card";
import { buildCreateSourceCardInput } from "@/lib/domain/source-card";
import { buildCreateStockCardInput, validateStockSymbol } from "@/lib/domain/stock-card";
import { useCanvasCommands } from "@/components/canvas/use-canvas-commands";
import { getCardType } from "@/components/cards/registry";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useWorkspaceUi } from "@/components/workspace/workspace-ui";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { resolveStockQuote } from "@/server/actions";

type FormTarget = "youtube" | "web" | "article" | "stock";

export function AddMenu() {
  const { snapshot } = useWorkspace();
  const { persistCreatedNote, persistCreatedColumn } = useCanvasCommands();
  const { openWatchBotCreate } = useWorkspaceUi();
  const [form, setForm] = useState<{ target: FormTarget; initial?: string } | null>(null);
  const canvasId = snapshot.currentCanvasId;

  async function runEntry(entry: AddCatalogEntry, initial?: string) {
    if (!canvasId) return;
    if (entry.creationMode === "note") {
      const type = getCardType("note")!;
      await persistCreatedNote(buildCreateNoteCardInput({ canvasId, text: "", position: dashboardFreeCardPosition(snapshot, type.defaultSize), size: type.defaultSize }));
      return;
    }
    if (entry.creationMode === "column") {
      await persistCreatedColumn(canvasId);
      return;
    }
    if (entry.creationMode === "watchbot") {
      openWatchBotCreate(initial);
      return;
    }
    setForm({ target: entry.id as FormTarget, ...(initial ? { initial } : {}) });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex h-7 items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-100 px-2 text-xs font-medium text-zinc-950 shadow-sm hover:bg-white" aria-label="Add to Canvas">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 p-1.5">
          {(["Structure", "Cards"] as const).map((category, index) => (
            <div key={category}>
              {index > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]">{category}</DropdownMenuLabel>
              {ADD_CATALOG.filter((entry) => entry.category === category).map((entry) => {
                const Icon = entry.icon;
                return (
                  <DropdownMenuItem key={entry.id} className="gap-2.5 px-2 py-2" onSelect={(event) => { event.preventDefault(); void runEntry(entry); }}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300"><Icon className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-zinc-200">{entry.label}</span><span className="block truncate text-[11px] text-zinc-500">{entry.description}</span></span>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                  </DropdownMenuItem>
                );
              })}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <AddCardForm form={form} onClose={() => setForm(null)} />
    </>
  );
}

/** Used by the command bar too, so parsed slash commands run the same flow. */
export function AddCardForm({ form, onClose }: { form: { target: FormTarget; initial?: string } | null; onClose: () => void }) {
  const { snapshot } = useWorkspace();
  const { persistCreatedCard } = useCanvasCommands();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const target = form?.target;
  const canvasId = snapshot.currentCanvasId;

  function close() { setUrl(""); setTitle(""); setSymbol(""); setError(null); onClose(); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!target || !canvasId) { setError("Create a Canvas first"); return; }
    setPending(true); setError(null);
    try {
      const type = getCardType(target === "stock" ? "chart" : target);
      if (!type) throw new Error("Card type is unavailable");
      const position = dashboardFreeCardPosition(snapshot, type.defaultSize);
      if (target === "stock") {
        const resolvedSymbol = validateStockSymbol(symbol || form?.initial || "");
        const quote = await resolveStockQuote(resolvedSymbol);
        if (quote.status !== "ok") throw new Error(quote.message);
        await persistCreatedCard(buildCreateStockCardInput({ canvasId, payload: quote.payload, position, size: type.defaultSize }));
      } else {
        await persistCreatedCard(buildCreateSourceCardInput({ canvasId, type: target, sourceUrl: url || form?.initial || "", title, position, size: type.defaultSize }));
      }
      close();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add Card"); }
    finally { setPending(false); }
  }
  const label = target ? ADD_CATALOG.find((entry) => entry.id === target)?.label ?? "Card" : "Card";
  return <Dialog.Root open={Boolean(form)} onOpenChange={(open) => { if (!open) close(); }}>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px]" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-800 bg-[#11141a] p-4 shadow-2xl focus:outline-none">
        <Dialog.Title className="text-sm font-medium text-zinc-100">Add {label}</Dialog.Title>
        <form className="mt-3 flex flex-col gap-2" onSubmit={(event) => void submit(event)}>
          {target === "stock" ? <Input autoFocus required value={symbol || form?.initial || ""} onChange={(event) => setSymbol(event.target.value)} placeholder="AAPL" aria-label="Stock symbol" disabled={pending} /> : <>
            <Input autoFocus required type="url" value={url || form?.initial || ""} onChange={(event) => setUrl(event.target.value)} placeholder={target === "youtube" ? "https://www.youtube.com/watch?v=…" : "https://example.com/story"} aria-label={`${label} URL`} disabled={pending} />
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title (optional)" aria-label={`${label} title`} disabled={pending} />
          </>}
          {error ? <p className="text-xs text-red-400" role="alert">{error}</p> : null}
          <div className="mt-1 flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" disabled={pending} onClick={close}>Cancel</Button><Button type="submit" size="sm" disabled={pending}>{pending ? "Resolving…" : `Add ${label}`}</Button></div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

export type { AddCatalogId };
