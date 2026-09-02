import { describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/node";
import { createWorkerMonitoring } from "./monitoring";

vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  withScope: vi.fn((callback: (scope: { setTag: () => void }) => void) =>
    callback({ setTag: vi.fn() }),
  ),
  captureException: vi.fn(),
  flush: vi.fn(async () => true),
}));

describe("worker monitoring", () => {
  it("stays inert without a worker-scoped DSN", async () => {
    const monitoring = createWorkerMonitoring({});
    monitoring.capture(new Error("ignored"), "worker_main");
    await monitoring.flush();
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.flush).not.toHaveBeenCalled();
  });

  it("captures errors with PII and tracing disabled", async () => {
    const monitoring = createWorkerMonitoring({
      SENTRY_DSN: "https://public@example.invalid/1",
      NODE_ENV: "test",
    });
    const error = new Error("boom");
    monitoring.capture(error, "watchbot_tick");
    await monitoring.flush();

    expect(Sentry.init).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sendDefaultPii: false,
        tracesSampleRate: 0,
      }),
    );
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(Sentry.flush).toHaveBeenCalledWith(2_000);
  });
});
