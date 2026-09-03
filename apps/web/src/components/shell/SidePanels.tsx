"use client";

import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UntrustedText } from "@/components/cards/UntrustedText";
import { AgentPanel } from "@/components/shell/AgentPanel";
import { WatchBotCanvasPanel } from "@/components/shell/WatchBotManager";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useWorkspaceUi } from "@/components/workspace/workspace-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  GUEST_EXIT_BUTTON_LABEL,
  GUEST_EXIT_CONFIRM_LABEL,
  GUEST_EXIT_CONFIRM_MESSAGE,
  GUEST_EXIT_KEEP_LABEL,
  GUEST_WORKSPACE_BODY,
  GUEST_WORKSPACE_TITLE,
  GUEST_WORKSPACE_UPGRADE_NOTE,
} from "@/lib/auth/guest";
import {
  SIGNED_IN_SETTINGS_BODY,
  SIGNED_IN_SETTINGS_TITLE,
  openBentoVersionLabel,
  signedInAccountLabel,
} from "@/lib/settings-copy";
import { signOut } from "@/server/actions";
import { createBrowserSupabaseClient } from "@/server/supabase-browser";

export function SidePanels() {
  const { railPanel, agentOpen, setRailPanel, setAgentOpen } = useWorkspaceUi();

  return (
    <>
      {railPanel ? (
        <section
          className="absolute inset-y-0 left-14 z-30 flex w-[min(18rem,calc(100vw-3.5rem))] flex-col border-r border-[#262d38] bg-[#11141a] shadow-[14px_0_28px_rgba(0,0,0,0.14)]"
          aria-label={`${panelTitle(railPanel)} panel`}
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#262d38] px-3">
            <h2 className="text-sm font-medium text-zinc-100">
              {panelTitle(railPanel)}
            </h2>
            <button
              type="button"
              aria-label={`Close ${panelTitle(railPanel)} panel`}
              className="rounded-md p-1 text-zinc-500 transition-colors motion-reduce:transition-none hover:bg-zinc-800 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70"
              onClick={() => setRailPanel(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {railPanel === "canvases" ? <CanvasesPanel /> : null}
            {railPanel === "watchbots" ? <WatchBotCanvasPanel /> : null}
            {railPanel === "settings" ? <SettingsPanel /> : null}
          </div>
        </section>
      ) : null}

      {agentOpen ? (
        <aside
          className="absolute bottom-3 right-3 top-14 z-30 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col rounded-xl border border-zinc-800 bg-[#11141a]/95 p-4 shadow-2xl backdrop-blur-sm"
          aria-label="Agent"
        >
          <div className="mb-3 flex items-center justify-between">
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
          <div className="min-h-0 flex-1">
            <AgentPanel />
          </div>
        </aside>
      ) : null}
    </>
  );
}

function panelTitle(
  panel: NonNullable<ReturnType<typeof useWorkspaceUi>["railPanel"]>,
) {
  if (panel === "canvases") return "Canvases";
  if (panel === "watchbots") return "WatchBots · This Canvas";
  return "Settings";
}

function SettingsPanel() {
  const router = useRouter();
  const { isGuest, accountEmail } = useWorkspace();
  const [confirmGuestExit, setConfirmGuestExit] = useState(false);
  const [exitPending, setExitPending] = useState(false);

  async function performSignOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    await signOut();
    router.replace("/");
  }

  return (
    <div className="flex flex-col gap-4">
      {isGuest ? (
        <div className="border-b border-zinc-800/80 pb-4">
          <p className="text-xs font-medium text-zinc-200">{GUEST_WORKSPACE_TITLE}</p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">{GUEST_WORKSPACE_BODY}</p>
          <p className="mt-2 text-xs leading-5 text-zinc-600">
            {GUEST_WORKSPACE_UPGRADE_NOTE}
          </p>
        </div>
      ) : (
        <div className="border-b border-zinc-800/80 pb-4">
          <p className="text-xs font-medium text-zinc-200">{SIGNED_IN_SETTINGS_TITLE}</p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            <UntrustedText value={signedInAccountLabel(accountEmail)} />
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            {SIGNED_IN_SETTINGS_BODY}
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-600">
            {openBentoVersionLabel()}
          </p>
        </div>
      )}
      {isGuest ? (
        confirmGuestExit ? (
          <div className="flex flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-950/40 p-2">
            <p className="text-xs leading-5 text-zinc-400">
              {GUEST_EXIT_CONFIRM_MESSAGE}
            </p>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={exitPending}
                onClick={() => setConfirmGuestExit(false)}
              >
                {GUEST_EXIT_KEEP_LABEL}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={exitPending}
                onClick={() => {
                  setExitPending(true);
                  void performSignOut().finally(() => setExitPending(false));
                }}
              >
                {exitPending ? "Exiting…" : GUEST_EXIT_CONFIRM_LABEL}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setConfirmGuestExit(true)}
          >
            {GUEST_EXIT_BUTTON_LABEL}
          </Button>
        )
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void performSignOut();
          }}
        >
          Sign out
        </Button>
      )}
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
        className="flex gap-2"
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
        <Button type="submit" size="sm" className="shrink-0">
          Create
        </Button>
      </form>
      <ul className="space-y-1" aria-label="Canvases">
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
                    current
                      ? "bg-[#1d2430] shadow-[inset_0_0_0_1px_rgba(101,116,139,0.28)]"
                      : "hover:bg-zinc-900",
                  )}
                >
                  <button
                    type="button"
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "min-w-0 flex-1 truncate text-left text-sm transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70",
                      current ? "font-medium text-zinc-50" : "text-zinc-300",
                    )}
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
                    aria-label={`Rename ${canvas.name}`}
                    title="Rename Canvas"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors motion-reduce:transition-none hover:bg-zinc-800 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70"
                    onClick={() => {
                      setEditingId(canvas.id);
                      setEditingName(canvas.name);
                    }}
                  >
                    <Pencil className="h-3 w-3" aria-hidden />
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
