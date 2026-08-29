import { listWebMcpTools } from "@openbento/domain";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "OpenBento WebMCP",
  description:
    "Phase 2 WebMCP tools — 1:1 snake_case wrappers around the shared domain catalog.",
};

export default function WebMcpJudgePage() {
  const tools = listWebMcpTools();

  return (
    <main className="h-full overflow-auto bg-[#0b0d10] px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Isolated Phase 2 · draft
        </p>
        <h1 className="mt-2 text-2xl font-medium">OpenBento WebMCP</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Tools are 1:1 snake_case wrappers over{" "}
          <code className="text-zinc-300">@openbento/domain</code>{" "}
          <code className="text-zinc-300">ACTION_CATALOG</code>. Execute goes
          through <code className="text-zinc-300">runBoundAction</code> +{" "}
          <code className="text-zinc-300">requireSessionOwnerId</code>, which
          constructs <code className="text-zinc-300">createActionExecutor</code>{" "}
          with the session owner. <code className="text-zinc-300">ownerId</code>{" "}
          is never accepted on tool arguments. No demo or echo tools.
        </p>

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
          <h2 className="text-sm font-medium text-zinc-200">How to run</h2>
          <p>
            From the repo root: <code className="text-zinc-300">pnpm install</code>{" "}
            then <code className="text-zinc-300">pnpm --filter web dev</code>.
            Open the canvas at <code className="text-zinc-300">/</code>. This
            page is <code className="text-zinc-300">/webmcp</code>.
          </p>
          <p>
            Chrome 149+ (or ChatGPT in-app browser): enable{" "}
            <code className="text-zinc-300">
              chrome://flags/#enable-webmcp-testing
            </code>
            . The canvas page calls{" "}
            <code className="text-zinc-300">document.modelContext.registerTool</code>{" "}
            for each row above when the API is present.
          </p>
          <h2 className="mt-6 text-sm font-medium text-zinc-200">How to eval</h2>
          <p>
            Programmatic eval (same session path as tools):{" "}
            <code className="text-zinc-300">pnpm test</code>. Tests call{" "}
            <code className="text-zinc-300">configureAuthSession</code> and
            invoke tools through{" "}
            <code className="text-zinc-300">createBoundWebMcpRuntime</code>.
            Until Auth lands, an unset session port fails closed (
            <code className="text-zinc-300">unauthenticated</code>) — there is
            no local-session owner fallback on this path.
          </p>
          <p>
            <code className="text-zinc-300">create_card</code> is bounds-only
            (extra <code className="text-zinc-300">frameId</code> is rejected).
            After <code className="text-zinc-300">create_card</code>,{" "}
            <code className="text-zinc-300">move_card</code>, and{" "}
            <code className="text-zinc-300">resize_card</code>, invoke runs a
            follow-up <code className="text-zinc-300">setCardFrame</code> from{" "}
            <code className="text-zinc-300">selectSmallestContainingFrame</code>
            via the same <code className="text-zinc-300">runBoundAction</code>.{" "}
            <code className="text-zinc-300">fullscreen_frame</code> is view-only
            and does not rewrite stored geometry.
          </p>
          <p>
            No SQL apply. No deploy. Isolated Phase 2 PR against{" "}
            <code className="text-zinc-300">main</code>.
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
