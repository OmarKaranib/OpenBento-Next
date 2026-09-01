import { describe, expect, it } from "vitest";
import {
  XHttpBudget,
  xMaxRequestsPerWorkerTick,
  X_MAX_REQUESTS_PER_WORKER_TICK_CEILING,
  X_MAX_REQUESTS_PER_WORKER_TICK_DEFAULT,
} from "./x-http-budget";

describe("XHttpBudget", () => {
  it("defaults to one request per worker tick", () => {
    expect(xMaxRequestsPerWorkerTick({})).toBe(
      X_MAX_REQUESTS_PER_WORKER_TICK_DEFAULT,
    );
    expect(X_MAX_REQUESTS_PER_WORKER_TICK_DEFAULT).toBe(1);
  });

  it("clamps env values to a conservative ceiling", () => {
    expect(
      xMaxRequestsPerWorkerTick({ X_MAX_REQUESTS_PER_WORKER_TICK: "99" }),
    ).toBe(X_MAX_REQUESTS_PER_WORKER_TICK_CEILING);
    expect(
      xMaxRequestsPerWorkerTick({ X_MAX_REQUESTS_PER_WORKER_TICK: "3" }),
    ).toBe(3);
    expect(
      xMaxRequestsPerWorkerTick({ X_MAX_REQUESTS_PER_WORKER_TICK: "bad" }),
    ).toBe(X_MAX_REQUESTS_PER_WORKER_TICK_DEFAULT);
  });

  it("tracks actual HTTP consumption across shared ticks", () => {
    const budget = new XHttpBudget(1);
    expect(budget.tryConsume()).toBe(true);
    expect(budget.httpRequests).toBe(1);
    expect(budget.isExhausted()).toBe(true);
    expect(budget.tryConsume()).toBe(false);
    expect(budget.httpRequests).toBe(1);
  });
});
