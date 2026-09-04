export function OpenBentoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- locked local favicon brand asset.
    <img
      src="/favicon.ico"
      alt=""
      className={className ?? "h-7 w-7"}
      aria-hidden
      data-brand-slot="openbento-mark"
    />
  );
}
