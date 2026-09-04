import type { CreateCardInput, Point, Size, StockChartPayload } from "@openbento/domain";
import { isValidCardPayload } from "@openbento/domain";

export const STOCK_DEFAULT_SIZE: Size = { width: 320, height: 220 };
export const STOCK_SYMBOL_PATTERN = /^[A-Z][A-Z0-9.\-]{0,11}$/;

export function normalizeStockSymbol(value: string): string {
  return value.trim().toUpperCase();
}

export function validateStockSymbol(value: string): string {
  const symbol = normalizeStockSymbol(value);
  if (!STOCK_SYMBOL_PATTERN.test(symbol)) {
    throw new Error("Use 1–12 letters, numbers, dots, or hyphens (for example AAPL)");
  }
  return symbol;
}

export function buildCreateStockCardInput(args: {
  canvasId: string;
  payload: StockChartPayload;
  position?: Point;
  size?: Size;
}): CreateCardInput {
  if (!isValidCardPayload("chart", args.payload)) {
    throw new Error("Stock payload failed PAYLOAD_SCHEMAS.chart");
  }
  return {
    canvasId: args.canvasId,
    type: "chart",
    payload: args.payload,
    ...(args.position ? { position: args.position } : {}),
    size: args.size ?? STOCK_DEFAULT_SIZE,
  };
}
