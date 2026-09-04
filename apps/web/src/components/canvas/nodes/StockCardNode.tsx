"use client";

import type { Node, NodeProps } from "@xyflow/react";
import type { StockChartPayload } from "@openbento/domain";
import { TrendingDown, TrendingUp } from "lucide-react";
import { CardNodeResizer } from "@/components/cards/CardNodeResizer";
import { NewCardBadge } from "@/components/cards/NewCardBadge";
import { UntrustedText } from "@/components/cards/UntrustedText";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useCanvasMonitorOptional } from "@/components/workspace/canvas-monitor";
import { cn } from "@/lib/utils";

export type StockNode = Node<{ cardId: string; parked?: boolean }, "chart">;

export function StockCardNode({ data, selected }: NodeProps<StockNode>) {
  const { snapshot } = useWorkspace();
  const monitor = useCanvasMonitorOptional();
  const card = snapshot.cards.find((entry) => entry.id === data.cardId);
  if (!card || card.type !== "chart" || card.payload.kind !== "stock") return null;

  const payload = card.payload as StockChartPayload;
  const isNew = monitor?.isCardNew(card.id) ?? false;
  const positive = (payload.change ?? 0) >= 0;
  const price = payload.price;
  const hasQuote = typeof price === "number";
  const changeLabel = hasQuote && typeof payload.change === "number"
    ? `${positive ? "+" : ""}${formatMoney(payload.change, payload.currency)}`
    : null;
  const percentLabel = hasQuote && typeof payload.changePercent === "number"
    ? `${positive ? "+" : ""}${payload.changePercent.toFixed(2)}%`
    : null;

  return (
    <div className="relative h-full w-full overflow-visible" style={{ minWidth: 250, minHeight: 180 }}>
      <CardNodeResizer card={card} selected={selected} minWidth={250} minHeight={180} />
      <article
        data-card-visual-shell
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-xl border border-[#2a3140] bg-[#161a22] shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
          isNew && "ring-1 ring-indigo-400/70",
          data.parked && "opacity-45 grayscale",
        )}
      >
        <header className="flex items-start justify-between px-3 pt-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-100"><UntrustedText value={payload.name ?? payload.symbol} /></p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">{payload.symbol}</p>
          </div>
          {isNew ? <NewCardBadge /> : null}
        </header>
        <div className="flex min-h-0 flex-1 flex-col justify-between px-3 pb-3 pt-3">
          {hasQuote ? (
            <>
              <div className="flex items-end justify-between gap-3">
                <p className="text-2xl font-semibold tracking-tight text-zinc-50">{formatMoney(price!, payload.currency)}</p>
                {changeLabel ? (
                  <p className={cn("flex items-center gap-1 text-xs font-medium", positive ? "text-emerald-400" : "text-rose-400")}>
                    {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {changeLabel}{percentLabel ? ` (${percentLabel})` : ""}
                  </p>
                ) : null}
              </div>
              <StockSparkline points={payload.points} positive={positive} />
              <p className="text-[10px] text-zinc-500">{payload.currency ?? "Currency unavailable"}{payload.asOf ? ` · As of ${formatAsOf(payload.asOf)}` : ""}</p>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 p-3 text-xs leading-5 text-zinc-500">
              Quote unavailable. This Card will not request market data while it is rendered or parked.
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

function StockSparkline({ points, positive }: { points: StockChartPayload["points"]; positive: boolean }) {
  if (!points || points.length < 2) {
    return <div className="h-12 rounded-md bg-zinc-900/40" aria-label="No historical trend data available" />;
  }
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 42 - ((value - min) / range) * 34;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 48" preserveAspectRatio="none" className="h-12 w-full" aria-label="Recent price trend" role="img">
      <path d={path} fill="none" vectorEffect="non-scaling-stroke" stroke={positive ? "#34d399" : "#fb7185"} strokeWidth="1.5" />
    </svg>
  );
}

function formatMoney(value: number, currency?: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD", maximumFractionDigits: 2 }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

function formatAsOf(value: string): string {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? "date unavailable" : new Date(parsed).toISOString().slice(0, 10);
}
