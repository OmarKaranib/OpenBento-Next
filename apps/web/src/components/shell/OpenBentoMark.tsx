export function OpenBentoMark({ className }: { className?: string }) {
  return (
    <div
      className={className}
      aria-hidden
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 2,
        width: 28,
        height: 28,
        padding: 4,
        borderRadius: 7,
        background: "#1c212b",
      }}
    >
      <span className="rounded-[2px] bg-zinc-100" />
      <span className="rounded-[2px] bg-zinc-500" />
      <span className="rounded-[2px] bg-indigo-300/80" />
      <span className="rounded-[2px] bg-zinc-400" />
    </div>
  );
}
