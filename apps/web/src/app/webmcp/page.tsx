import { listWebMcpTools } from "@openbento/domain";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "OpenBento WebMCP",
  description:
    "Use WebMCP to let an agent build and organize an OpenBento live intelligence Canvas.",
};

export default function WebMcpJudgePage() {
  const tools = listWebMcpTools();

  return (
    <main className="h-full overflow-auto bg-[#0b0d10] px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          WebMCP Challenge preview
        </p>
        <h1 className="mt-2 text-2xl font-medium">OpenBento WebMCP</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          OpenBento is a living intelligence Canvas for following an evolving
          story through original sources, Cards, a canonical dashboard Frame, and persistent
          WatchBots. WebMCP lets an agent operate that visual workspace with a
          person instead of only returning a chat response.
        </p>

        <section className="mt-8">
          <h2 className="text-sm font-medium text-zinc-200">Why WebMCP matters</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            A human can arrange and inspect the Canvas directly while an agent
            can create or rename a Canvas, move its camera, create or edit
            Cards, enter a focused dashboard view, and start or manage a
            WatchBot. Every tool uses the same domain operation as the human
            interface, so agent changes appear in the same workspace with the
            same ownership and geometry rules.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-sm leading-6 text-zinc-400">
          <h2 className="text-sm font-medium text-zinc-200">Try this</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>“Create a Canvas called Climate Briefing.”</li>
            <li>“Add a Note Card for the key question, then move it into the dashboard.”</li>
            <li>“Fullscreen the dashboard for a focused monitoring view.”</li>
            <li>“Create a WatchBot that monitors meaningful developments and preserves sources.”</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-medium text-zinc-200">Registered tools</h2>
          <table className="mt-3 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="py-2 pr-4 font-medium">WebMCP tool</th>
                <th className="py-2 font-medium">Domain action</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr key={tool.name} className="border-b border-zinc-900">
                  <td className="py-2 pr-4 font-mono text-xs text-zinc-200">
                    {tool.name}
                  </td>
                  <td className="py-2 font-mono text-xs text-zinc-400">
                    {tool.actionName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-8 space-y-3 text-sm leading-6 text-zinc-400">
          <h2 className="text-sm font-medium text-zinc-200">Test locally</h2>
          <p>
            From the repo root: <code className="text-zinc-300">pnpm install</code>{" "}
            then <code className="text-zinc-300">pnpm --filter web dev</code>.
            Open the canvas at <code className="text-zinc-300">/</code>. This
            page is <code className="text-zinc-300">/webmcp</code>.
          </p>
          <p>
            In ChatGPT’s in-app browser, or Chrome 149+ with{" "}
            <code className="text-zinc-300">
              chrome://flags/#enable-webmcp-testing
            </code>
            , the Canvas registers the tools above when{" "}
            <code className="text-zinc-300">document.modelContext.registerTool</code>{" "}
            is available. Ordinary browsers continue to run the Canvas without
            WebMCP registration.
          </p>
          <h2 className="mt-6 text-sm font-medium text-zinc-200">What to verify</h2>
          <p>
            Create a Card outside the dashboard, then ask the agent to move it inside:
            membership updates automatically from geometry. Fullscreen a Frame:
            it is a view only, so the stored Canvas layout does not change.
            WatchBot changes use the same shared operations as the rest of the
            Canvas.
          </p>
          <p>
            Automated workflow and adversarial evaluations run with{" "}
            <code className="text-zinc-300">pnpm test</code>. Tools require an
            authenticated session; they cannot accept a user identity, direct
            Frame membership, or Frame geometry mutations from agent input.
          </p>
        </section>

        <p className="mt-10 text-sm">
          <Link className="text-zinc-300 underline" href="/">
            Back to canvas
          </Link>
        </p>
      </div>
    </main>
  );
}
