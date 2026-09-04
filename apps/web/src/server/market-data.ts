import type { StockChartPayload } from "@openbento/domain";
import { normalizeStockSymbol, validateStockSymbol } from "@/lib/domain/stock-card";

const PROVIDER_TIMEOUT_MS = 8_000;
const MAX_POINTS = 30;

export type MarketDataResult =
  | { status: "ok"; payload: StockChartPayload }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

type FetchLike = typeof fetch;

/**
 * Server-only market adapter. It is deliberately explicit: no browser key,
 * no provider auto-selection, and no periodic fetches from rendered Cards.
 */
export async function resolveStockMarketData(
  rawSymbol: string,
  options: { env?: NodeJS.ProcessEnv; fetchImpl?: FetchLike } = {},
): Promise<MarketDataResult> {
  const symbol = validateStockSymbol(rawSymbol);
  const env = options.env ?? process.env;
  const provider = env.MARKET_DATA_PROVIDER?.trim().toLowerCase() || "none";
  const apiKey = env.MARKET_DATA_API_KEY?.trim();
  if (provider === "none" || !apiKey) {
    return {
      status: "unavailable",
      message: "Market data is not configured on this server.",
    };
  }
  if (provider !== "alphavantage") {
    return { status: "unavailable", message: "Configured market provider is unavailable." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const url = new URL("https://www.alphavantage.co/query");
    url.searchParams.set("function", "TIME_SERIES_DAILY");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("outputsize", "compact");
    url.searchParams.set("apikey", apiKey);
    const response = await (options.fetchImpl ?? fetch)(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return { status: "error", message: "Market data is temporarily unavailable." };
    }
    const body: unknown = await response.json();
    const payload = parseAlphaVantageDaily(body, symbol);
    return payload
      ? { status: "ok", payload }
      : { status: "error", message: "No market data was available for that symbol." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error && error.name === "AbortError"
        ? "Market data timed out. Try again."
        : "Market data could not be loaded. Try again.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function parseAlphaVantageDaily(
  body: unknown,
  rawSymbol: string,
): StockChartPayload | null {
  if (!isRecord(body)) return null;
  const series = body["Time Series (Daily)"];
  if (!isRecord(series)) return null;
  const rows: Array<{ date: string; close: number }> = [];
  for (const [date, value] of Object.entries(series)) {
    if (!isRecord(value)) continue;
    const close = numberFrom(value["4. close"]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && close !== null && close >= 0) {
      rows.push({ date, close });
    }
  }
  const recentRows = rows.sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_POINTS);
  if (recentRows.length === 0) return null;
  const latest = recentRows.at(-1)!;
  const previous = recentRows.at(-2);
  const change = previous ? latest.close - previous.close : undefined;
  const changePercent = previous && previous.close > 0
    ? (change! / previous.close) * 100
    : undefined;
  return {
    kind: "stock",
    symbol: normalizeStockSymbol(rawSymbol),
    price: latest.close,
    currency: "USD",
    ...(change !== undefined ? { change } : {}),
    ...(changePercent !== undefined ? { changePercent } : {}),
    ...(previous ? { previousClose: previous.close } : {}),
    asOf: `${latest.date}T00:00:00.000Z`,
    points: recentRows.map((entry) => ({ t: `${entry.date}T00:00:00.000Z`, value: entry.close })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberFrom(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
