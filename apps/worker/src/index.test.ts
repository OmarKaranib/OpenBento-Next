import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainStore } from "@openbento/domain";
import type { WorkerCycleResult } from "./cycle";
import {
  isWorkerEnabled,
  main,
  workerIntervalMs,
  WORKER_INTERVAL_MS_CEILING,
  WORKER_INTERVAL_MS_DEFAULT,
} from "./index";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(dir, "index.ts"), "utf8");
const pkg = JSON.parse(
  readFileSync(join(dir, "../package.json"), "utf8"),
) as { scripts: Record<string, string> };

const EMPTY_CYCLE: WorkerCycleResult = {
  processed: 0,
  skippedPaused: 0,
  skippedOther: 0,
  cardsCreated: 0,
  errors: 0,
  cycles: [],
};

function clearPersistEnv(): void {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.OPENBENTO_WORKER_ENABLED;
  delete process.env.OPENBENTO_WORKER_INTERVAL_MS;
  delete process.env.X_PROVIDER_ENABLED;
  delete process.env.X_BEARER_TOKEN;
}

beforeEach(clearPersistEnv);
afterEach(clearPersistEnv);

describe("worker persist factory", () => {
  it("uses createWorkerDomainStore and not web getDomainStore", () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).toMatch(/createWorkerDomainStore/);
    expect(code).not.toMatch(/getDomainStore/);
    expect(code).not.toMatch(/InMemoryDomainStore/);
  });

  it("default start scripts use the durable store, not the in-memory fixture", () => {
    expect(pkg.scripts.start).toBe("tsx src/index.ts --once");
    expect(pkg.scripts.start).not.toMatch(/--fixture/);
    expect(pkg.scripts["start:loop"]).toBe("tsx src/index.ts --loop");
    expect(pkg.scripts["start:loop"]).not.toMatch(/--fixture/);
    expect(pkg.scripts["start:fixture"]).toBe("tsx src/index.ts --once --fixture");
  });

  it("enabled path cannot start on InMemoryDomainStore", async () => {
    process.env.OPENBENTO_WORKER_ENABLED = "true";
    await expect(main(["--once"])).rejects.toThrow(
      /No in-memory runtime fallback|SUPABASE_SERVICE_ROLE_KEY|Supabase env is required/i,
    );
  });

  it("exits non-zero intent when enabled but service-role is missing", async () => {
    process.env.OPENBENTO_WORKER_ENABLED = "true";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "sb_publishable_placeholder";
    await expect(main(["--once"])).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});

describe("OPENBENTO_WORKER_ENABLED fail closed", () => {
  it("is disabled when absent or false", () => {
    expect(isWorkerEnabled({})).toBe(false);
    expect(isWorkerEnabled({ OPENBENTO_WORKER_ENABLED: "false" })).toBe(false);
    expect(isWorkerEnabled({ OPENBENTO_WORKER_ENABLED: "true" })).toBe(true);
    expect(isWorkerEnabled({ OPENBENTO_WORKER_ENABLED: "1" })).toBe(true);
  });

  it("caps the optional interval", () => {
    expect(workerIntervalMs({})).toBe(WORKER_INTERVAL_MS_DEFAULT);
    expect(
      workerIntervalMs({ OPENBENTO_WORKER_INTERVAL_MS: "999999" }),
    ).toBe(WORKER_INTERVAL_MS_CEILING);
    expect(workerIntervalMs({ OPENBENTO_WORKER_INTERVAL_MS: "15000" })).toBe(
      15_000,
    );
  });

  it.each([undefined, "false"])(
    "exits cleanly with gate value %s and constructs no store or cycle",
    async (gate) => {
      if (gate !== undefined) {
        process.env.OPENBENTO_WORKER_ENABLED = gate;
      }
      const createStore = vi.fn(() => {
        throw new Error("service-role client must not be constructed");
      });
      const runCycle = vi.fn(async () => EMPTY_CYCLE);

      await expect(
        main(["--once"], {
          createStore: createStore as unknown as () => DomainStore,
          runCycle,
        }),
      ).resolves.toBeUndefined();
      expect(createStore).not.toHaveBeenCalled();
      expect(runCycle).not.toHaveBeenCalled();
    },
  );

  it("an already-aborted loop exits immediately without a store or cycle", async () => {
    process.env.OPENBENTO_WORKER_ENABLED = "true";
    const controller = new AbortController();
    controller.abort();
    const createStore = vi.fn(() => {
      throw new Error("service-role client must not be constructed");
    });
    const runCycle = vi.fn(async () => EMPTY_CYCLE);

    await expect(
      main(["--loop"], {
        createStore: createStore as unknown as () => DomainStore,
        runCycle,
        abortSignal: controller.signal,
      }),
    ).resolves.toBeUndefined();
    expect(createStore).not.toHaveBeenCalled();
    expect(runCycle).not.toHaveBeenCalled();
  });

  it("global disable precedes X credential and provider construction", async () => {
    process.env.X_PROVIDER_ENABLED = "true";
    const createStore = vi.fn(() => {
      throw new Error("service-role client must not be constructed");
    });

    await expect(
      main(["--loop", "--provider=x"], {
        createStore: createStore as unknown as () => DomainStore,
      }),
    ).resolves.toBeUndefined();
    expect(createStore).not.toHaveBeenCalled();
  });

  it("enabled worker keeps the independently disabled X lane inert", async () => {
    process.env.OPENBENTO_WORKER_ENABLED = "true";
    process.env.X_PROVIDER_ENABLED = "false";

    await expect(
      main(["--once", "--fixture", "--provider=x"]),
    ).resolves.toBeUndefined();
  });

  it("enabled X lane fails closed before a cycle when its token is missing", async () => {
    process.env.OPENBENTO_WORKER_ENABLED = "true";
    process.env.X_PROVIDER_ENABLED = "true";

    await expect(
      main(["--once", "--fixture", "--provider=x"]),
    ).rejects.toMatchObject({ code: "credential_missing" });
  });

  it("an enabled loop shuts down cleanly when aborted", async () => {
    process.env.OPENBENTO_WORKER_ENABLED = "true";
    const controller = new AbortController();
    const runCycle = vi.fn(async () => {
      controller.abort();
      return EMPTY_CYCLE;
    });

    await expect(
      main(["--loop"], {
        createStore: () => ({}) as DomainStore,
        runCycle,
        abortSignal: controller.signal,
      }),
    ).resolves.toBeUndefined();
    expect(runCycle).toHaveBeenCalledTimes(1);
  });

  it("registers SIGTERM and SIGINT for enabled loops", () => {
    expect(source).toMatch(/SIGTERM/);
    expect(source).toMatch(/SIGINT/);
    expect(source).toMatch(/isWorkerEnabled/);
  });
});
