import { cn } from "@/lib/utils";

/**
 * Stable shell brand slot. Replace only this component when the final
 * OpenBento asset is ready; the rail supplies placement and sizing.
 */
export function OpenBentoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid h-7 w-7 grid-cols-2 gap-0.5 rounded-md bg-[#1c212b] p-1",
        className,
      )}
      aria-hidden
      data-brand-slot="openbento-mark"
    >
      <span className="rounded-[2px] bg-zinc-100" />
      <span className="rounded-[2px] bg-zinc-500" />
      <span className="rounded-[2px] bg-indigo-300/80" />
      <span className="rounded-[2px] bg-zinc-400" />
    </div>
  );
}
