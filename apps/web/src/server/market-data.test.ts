import { describe, expect, it } from "vitest";
import { parseAlphaVantageDaily, resolveStockMarketData } from "./market-data";

describe("market data boundary", () => {
  it("fails closed when a server-only provider credential is absent", async () => {
    await expect(resolveStockMarketData("AAPL", { env: {} })).resolves.toEqual({
      status: "unavailable",
      message: "Market data is not configured on this server.",
    });
  });

  it("parses a bounded stock snapshot without retaining provider response fields", () => {
    const payload = parseAlphaVantageDaily({
      "Time Series (Daily)": {
        "2026-09-03": { "4. close": "210.00", ignored: "secret" },
        "2026-09-04": { "4. close": "214.50" },
      },
      "Error Message": "ignored",
    }, "aapl");
    expect(payload).toMatchObject({
      kind: "stock", symbol: "AAPL", price: 214.5, previousClose: 210, change: 4.5,
    });
    expect(payload?.points).toHaveLength(2);
    expect(JSON.stringify(payload)).not.toContain("ignored");
  });
});
