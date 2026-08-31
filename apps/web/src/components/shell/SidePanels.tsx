"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WatchBotCanvasPanel } from "@/components/shell/WatchBotManager";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useWorkspaceUi } from "@/components/workspace/workspace-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { signOut } from "@/server/actions";
import { createBrowserSupabaseClient } from "@/server/supabase-browser";

export function SidePanels() {
  const { railPanel, agentOpen, setRailPanel, setAgentOpen } = useWorkspaceUi();

  return (
    <>
      {railPanel ? (
        <section
          className="absolute bottom-0 left-14 top-0 z-20 w-72 border-r border-zinc-800/80 bg-[#11141a]/95 backdrop-blur-sm"
          aria-label={railPanel}
        >
          <div className="flex h-12 items-center justify-between px-3">
            <h2 className="text-sm font-medium text-zinc-100">
              {railPanel === "canvases"
                ? "Canvases"
                : railPanel === "watchbots"
                  ? "WatchBots · This Canvas"
                  : "Settings"}
            </h2>
            <button
              type="button"
              aria-label="Close panel"
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              onClick={() => setRailPanel(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-3 pb-4">
            {railPanel === "canvases" ? <CanvasesPanel /> : null}
            {railPanel === "watchbots" ? <WatchBotCanvasPanel /> : null}
            {railPanel === "settings" ? <SettingsPanel /> : null}
          </div>
        </section>
      ) : null}

      {agentOpen ? (
        <aside
          className="absolute bottom-3 right-3 top-14 z-20 w-80 rounded-xl border border-zinc-800 bg-[#11141a]/95 p-4 shadow-2xl backdrop-blur-sm"
          aria-label="Agent"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-100">Agent</h2>
            <button
              type="button"
              aria-label="Close Agent"
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              onClick={() => setAgentOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-500">
            Interactive Agent panel arrives in a later phase. This control stays
            in the top-right — not the left rail or Canvas toolbar.
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-500">
            WebMCP tools on this page are the Issue #1 snake_case catalog
            wrappers. They dispatch through{" "}
            <code className="text-zinc-400">runBoundAction</code> +{" "}
            <code className="text-zinc-400">requireOwnerIdFromRequest</code>.{" "}
            <Link className="text-zinc-300 underline" href="/webmcp">
              Judge notes
            </Link>
            .
          </p>
        </aside>
      ) : null}
    </>
  );
}

function PlaceholderCopy({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-300">{title}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{body}</p>
    </div>
  );
}

function SettingsPanel() {
  const router = useRouter();
  const { isGuest } = useWorkspace();
  return (
    <div className="flex flex-col gap-3">
      {isGuest ? (
        <PlaceholderCopy
          title="Guest workspace"
          body="This workspace is tied to this browser. Sign in or create an account to keep access across devices."
        />
      ) : (
        <PlaceholderCopy
          title="Settings"
          body="Canvas writes go through server runDomainAction. ownerId comes from Supabase Auth getUser() / auth.uid(), never from action JSON or the unsigned ob_local_session cookie."
        />
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          void (async () => {
            const supabase = createBrowserSupabaseClient();
            await supabase.auth.signOut();
            await signOut();
            router.replace("/");
          })();
        }}
      >
        Sign out
      </Button>
    </div>
  );
}

function CanvasesPanel() {
  const { snapshot, execute } = useWorkspace();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          const name = draft.trim() || "Untitled";
          void execute("createCanvas", { name });
          setDraft("");
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="New Canvas name"
          aria-label="New Canvas name"
        />
        <Button type="submit" size="sm">
          Create
        </Button>
      </form>
      <ul className="space-y-1">
        {snapshot.canvases.map((canvas) => {
          const current = canvas.id === snapshot.currentCanvasId;
          return (
            <li key={canvas.id}>
              {editingId === canvas.id ? (
                <form
                  className="flex gap-1"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const name = editingName.trim();
                    if (name) {
                      void execute("renameCanvas", { canvasId: canvas.id, name });
                    }
                    setEditingId(null);
                  }}
                >
                  <Input
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    autoFocus
                    aria-label="Rename Canvas"
                  />
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </form>
              ) : (
                <div
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1.5",
                    current ? "bg-zinc-800/80" : "hover:bg-zinc-900",
                  )}
                >
                  <button
                    type="button"
                    className="flex-1 truncate text-left text-sm text-zinc-200"
                    onClick={() => {
                      if (!current) {
                        void execute(
                          "switchCanvas",
                          { canvasId: canvas.id },
                          { history: false },
                        );
                      }
                    }}
                  >
                    {canvas.name}
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-zinc-500 hover:text-zinc-200"
                    onClick={() => {
                      setEditingId(canvas.id);
                      setEditingName(canvas.name);
                    }}
                  >
                    Rename
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
