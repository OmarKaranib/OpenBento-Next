import { describe, expect, it } from "vitest";
import {
  CLASSIFIER_MAX_CALLS_PER_CYCLE_CEILING,
  CLASSIFIER_MAX_CALLS_PER_CYCLE_DEFAULT,
  CLASSIFIER_MAX_CALLS_PER_TICK_CEILING,
  CLASSIFIER_MAX_CALLS_PER_TICK_DEFAULT,
  ClassifierCallBudget,
  classifierMaxCallsPerCycle,
  classifierMaxCallsPerWorkerTick,
} from "./classifier-budget";

describe("ClassifierCallBudget", () => {
  it("defaults to conservative per-tick and per-cycle ceilings", () => {
    expect(classifierMaxCallsPerWorkerTick({})).toBe(
      CLASSIFIER_MAX_CALLS_PER_TICK_DEFAULT,
    );
    expect(classifierMaxCallsPerCycle({})).toBe(
      CLASSIFIER_MAX_CALLS_PER_CYCLE_DEFAULT,
    );
    expect(CLASSIFIER_MAX_CALLS_PER_TICK_DEFAULT).toBe(5);
    expect(CLASSIFIER_MAX_CALLS_PER_CYCLE_DEFAULT).toBe(5);
  });

  it("clamps env values to conservative ceilings", () => {
    expect(
      classifierMaxCallsPerWorkerTick({
        WATCHBOT_MEANINGFULNESS_MAX_CALLS_PER_TICK: "99",
      }),
    ).toBe(CLASSIFIER_MAX_CALLS_PER_TICK_CEILING);
    expect(
      classifierMaxCallsPerCycle({
        WATCHBOT_MEANINGFULNESS_MAX_CALLS_PER_CYCLE: "99",
      }),
    ).toBe(CLASSIFIER_MAX_CALLS_PER_CYCLE_CEILING);
    expect(
      classifierMaxCallsPerWorkerTick({
        WATCHBOT_MEANINGFULNESS_MAX_CALLS_PER_TICK: "3",
      }),
    ).toBe(3);
    expect(
      classifierMaxCallsPerCycle({
        WATCHBOT_MEANINGFULNESS_MAX_CALLS_PER_CYCLE: "bad",
      }),
    ).toBe(CLASSIFIER_MAX_CALLS_PER_CYCLE_DEFAULT);
  });

  it("shares a tick cap across cycles and resets the cycle cap", () => {
    const budget = new ClassifierCallBudget(3, 2);
    budget.startCycle();
    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(false);
    expect(budget.calls).toBe(2);

    budget.startCycle();
    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(false);
    expect(budget.calls).toBe(3);
    expect(budget.isExhausted()).toBe(true);
  });
});
