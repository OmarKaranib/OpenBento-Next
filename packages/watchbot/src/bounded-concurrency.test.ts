import { describe, expect, it } from "vitest";
import { mapBounded } from "./bounded-concurrency";

describe("mapBounded", () => {
  it("preserves output order despite out-of-order completion", async () => {
    const completionOrder: number[] = [];
    const delays = [30, 10, 20, 5, 25, 15, 35, 8];

    const results = await mapBounded(delays, 3, async (delay, index) => {
      await new Promise((r) => setTimeout(r, delay));
      completionOrder.push(index);
      return `item-${index}`;
    });

    expect(results).toEqual(delays.map((_, i) => `item-${i}`));
    expect(completionOrder).not.toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("never exceeds configured concurrency", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    await mapBounded([1, 2, 3, 4, 5, 6, 7, 8], 3, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
    });

    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("handles concurrency=1 as sequential", async () => {
    const order: number[] = [];
    await mapBounded([1, 2, 3], 1, async (_, i) => {
      order.push(i);
      await new Promise((r) => setTimeout(r, 5));
      return i;
    });
    expect(order).toEqual([0, 1, 2]);
  });

  it("handles empty input", async () => {
    const results = await mapBounded([], 4, async () => "x");
    expect(results).toEqual([]);
  });

  it("isolates errors per item when caller catches", async () => {
    const results = await mapBounded([0, 1, 2], 2, async (_, i) => {
      if (i === 1) throw new Error("boom");
      return i;
    }).catch(() => "caught");
    expect(results).toBe("caught");
  });
});
