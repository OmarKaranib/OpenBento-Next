export default function Home() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-start justify-center gap-4 px-8 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
        OpenBento-Next
      </p>
      <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-zinc-50">
        OpenBento Next (Phase 0 foundation)
      </h1>
      <p className="max-w-xl text-base leading-7 text-zinc-400">
        AI-native live intelligence canvas. Canvas, Card, Frame, WatchBot.
        Shared domain actions live in{" "}
        <code className="font-mono text-zinc-300">packages/domain</code>. No
        canvas UI in this phase.
      </p>
    </main>
  );
}
