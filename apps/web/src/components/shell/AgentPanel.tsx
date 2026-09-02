"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { sendAgentMessage } from "@/server/agent-actions";
import type { AgentChatMessage, AgentToolActivity } from "@/agent/types";

function newId(): string {
  return crypto.randomUUID();
}

function ToolActivityList({ items }: { items: AgentToolActivity[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <ul className="mt-2 space-y-1 border-t border-zinc-800/80 pt-2">
      {items.map((item, index) => (
        <li
          key={`${item.name}-${index}`}
          className="flex gap-2 text-[11px] leading-4 text-zinc-500"
        >
          <span
            className={
              item.success ? "text-emerald-400/90" : "text-rose-400/90"
            }
          >
            {item.success ? "✓" : "✗"}
          </span>
          <span className="min-w-0 break-words">
            <span className="font-medium text-zinc-400">{item.name}</span>
            {" — "}
            {item.summary}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AgentPanel() {
  const { snapshot, execute } = useWorkspace();
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const canvasId = snapshot.currentCanvasId;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  async function onSend() {
    const text = draft.trim();
    if (!text || pending || !canvasId) {
      return;
    }
    setDraft("");
    setError(null);
    const userMessage: AgentChatMessage = {
      id: newId(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setPending(true);

    try {
      const history = [...messages, userMessage]
        .filter((message) => !message.error)
        .slice(-12)
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));

      const result = await sendAgentMessage({
        canvasId,
        message: text,
        history: history.slice(0, -1),
      });

      if (result.error) {
        setError(result.error);
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: result.assistantText || "Something went wrong.",
            toolActivity: result.toolActivity,
            error: result.error,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: result.assistantText,
            toolActivity: result.toolActivity,
          },
        ]);
      }

      if (result.toolCallCount > 0) {
        await execute(
          "getCanvasState",
          { canvasId },
          { history: false },
        );
      }
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Agent request failed.";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: "The Agent could not complete that request.",
          error: message,
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="text-xs leading-5 text-zinc-500">
            Ask me to organize this Canvas, create Frames or Notes, resize
            source Cards, or manage WatchBots. I act through OpenBento&apos;s
            shared actions — sources stay the story.
          </p>
        ) : null}
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "user"
                ? "rounded-lg bg-zinc-900/80 px-2.5 py-2"
                : "rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-2.5 py-2"
            }
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
              {message.role === "user" ? "You" : "Agent"}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-zinc-200">
              {message.content}
            </p>
            {message.toolActivity ? (
              <ToolActivityList items={message.toolActivity} />
            ) : null}
            {message.error ? (
              <p className="mt-2 text-[11px] leading-4 text-rose-400/90">
                {message.error}
              </p>
            ) : null}
          </div>
        ))}
        {pending ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Working…
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error && messages.length === 0 ? (
        <p className="mb-2 text-[11px] text-rose-400/90">{error}</p>
      ) : null}

      <form
        className="mt-3 flex gap-1 border-t border-zinc-800/80 pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onSend();
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={pending || !canvasId}
          placeholder={
            canvasId ? "Message the Agent…" : "Open a Canvas first"
          }
          aria-label="Agent message"
          className="h-9 min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-950/60 px-2.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
        />
        <Button
          type="submit"
          size="sm"
          disabled={pending || !draft.trim() || !canvasId}
          aria-label="Send"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
