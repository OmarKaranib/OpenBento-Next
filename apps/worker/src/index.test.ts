import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainStore } from "@openbento/domain";
import type { WorkerCycleResult } from "./cycle";
import {
  isWorkerEnabled,
  isWorkerRunOnce,
  main,
  resolveRunOnce,
  workerIntervalMs,
  WORKER_INTERVAL_MS_CEILING,
  WORKER_INTERVAL_MS_DEFAULT,
} from "./index";
import {
  assertSafeWorkerTelemetry,
  buildWorkerTickTelemetry,
  formatWorkerTickTelemetry,
} from "./telemetry";

const dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(dir, "../../..");
const source = readFileSync(join(dir, "index.ts"), "utf8");
const railwayWorker = readFileSync(join(repoRoot, "railway.worker.toml"), "utf8");
const pkg = JSON.parse(
  readFileSync(join(dir, "../package.json"), "utf8"),
) as { scripts: Record<string, string> };

const EMPTY_CYCLE: WorkerCycleResult = {
  watchBotsLoaded: 0,
  watchBotsProcessed: 0,
  providerEligibleWatchBots: 0,
  processed: 0,
  skippedPaused: 0,
  skippedOther: 0,
  cardsCreated: 0,
  discovered: 0,
  normalized: 0,
  novel: 0,
  duplicates: 0,
  rejectedRelevance: 0,
  errors: 0,
  xHttpRequests: 0,
  candidatesEligible: 0,
  selected: 0,
  cycles: [],
};

function clearPersistEnv(): void {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.OPENBENTO_WORKER_ENABLED;
  delete process.env.OPENBENTO_WORKER_RUN_ONCE;
  delete process.env.OPENBENTO_WORKER_INTERVAL_MS;
  delete process.env.X_PROVIDER_ENABLED;
  delete process.env.X_BEARER_TOKEN;
  delete process.env.X_MAX_REQUESTS_PER_WORKER_TICK;
}

beforeEach(clearPersistEnv);
afterEach(clearPersistEnv);

describe("Railway worker X start command", () => {
  it("selects --provider=x on the hosted loop start command", () => {
    const startLine = railwayWorker
      .split("\n")
      .find((line) => line.trimStart().startsWith("startCommand"));
    expect(startLine).toBe(
      'startCommand = "pnpm --filter worker start:loop -- --provider=x"',
    );
  });

  it("forwards --provider=x into argv the same way main selects the X adapter", () => {
    const forwarded = ["--loop", "--", "--provider=x"];
    expect(forwarded.includes("--provider=x")).toBe(true);
    expect(forwarded.includes("--loop")).toBe(true);
    expect(source).toMatch(/argv\.includes\("--provider=x"\)/);
  });
});

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

  it("worker=false with runOnce=true and X=true constructs nothing", async () => {
    process.env.OPENBENTO_WORKER_RUN_ONCE = "true";
    process.env.X_PROVIDER_ENABLED = "true";
    process.env.X_BEARER_TOKEN = "must-not-be-read";
    const createStore = vi.fn(() => {
      throw new Error("service-role client must not be constructed");
    });
    const runCycle = vi.fn(async () => EMPTY_CYCLE);

    await expect(
      main(["--loop", "--provider=x"], {
        createStore: createStore as unknown as () => DomainStore,
        runCycle,
      }),
    ).resolves.toBeUndefined();
    expect(createStore).not.toHaveBeenCalled();
    expect(runCycle).not.toHaveBeenCalled();
  });

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

  it("global disable exits before X/provider/store even when X env is present", async () => {
    process.env.X_PROVIDER_ENABLED = "true";
    process.env.X_BEARER_TOKEN = "must-not-be-read-while-worker-disabled";
    process.env.SUPABASE_SERVICE_ROLE_KEY =
      "must-not-be-read-while-worker-disabled";
    const createStore = vi.fn(() => {
      throw new Error("service-role client must not be constructed");
    });
    const runCycle = vi.fn(async () => EMPTY_CYCLE);

    await expect(
      main(["--loop", "--provider=x"], {
        createStore: createStore as unknown as () => DomainStore,
        runCycle,
      }),
    ).resolves.toBeUndefined();
    expect(createStore).not.toHaveBeenCalled();
    expect(runCycle).not.toHaveBeenCalled();
    const gateIdx = source.indexOf("if (!isWorkerEnabled(env))");
    const xIdx = source.indexOf("useX ? createXSourceProvider");
    const storeIdx = source.indexOf("options.createStore ?? createWorkerDomainStore");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(xIdx).toBeGreaterThan(gateIdx);
    expect(storeIdx).toBeGreaterThan(gateIdx);
  });

  it("enabled worker with X lane disabled runs zero X network requests", async () => {
    process.env.OPENBENTO_WORKER_ENABLED = "true";
    process.env.X_PROVIDER_ENABLED = "false";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      main(["--once", "--fixture", "--provider=x"]),
    ).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
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

describe("OPENBENTO_WORKER_RUN_ONCE", () => {
  it("accepts only true/1 semantics", () => {
    expect(isWorkerRunOnce({})).toBe(false);
    expect(isWorkerRunOnce({ OPENBENTO_WORKER_RUN_ONCE: "false" })).toBe(false);
    expect(isWorkerRunOnce({ OPENBENTO_WORKER_RUN_ONCE: "yes" })).toBe(false);
    expect(isWorkerRunOnce({ OPENBENTO_WORKER_RUN_ONCE: "true" })).toBe(true);
    expect(isWorkerRunOnce({ OPENBENTO_WORKER_RUN_ONCE: "1" })).toBe(true);
  });

  it("env runOnce overrides --loop in resolveRunOnce", () => {
    expect(resolveRunOnce(["--loop"], { OPENBENTO_WORKER_RUN_ONCE: "true" })).toBe(
      true,
    );
    expect(resolveRunOnce(["--loop"], {})).toBe(false);
    expect(resolveRunOnce(["--once"], {})).toBe(true);
    expect(resolveRunOnce([], {})).toBe(true);
  });

  it("runs exactly one tick with --loop when RUN_ONCE=true and exits without delay", async () => {
    process.env.OPENBENTO_WORKER_ENABLED = "true";
    process.env.OPENBENTO_WORKER_RUN_ONCE = "true";
    process.env.X_PROVIDER_ENABLED = "false";

    const delaySpy = vi.spyOn(global, "setTimeout");
    const stdout: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk) => {
        stdout.push(String(chunk));
        return true;
      });
    const runCycle = vi.fn(async () => EMPTY_CYCLE);

    await expect(
      main(["--loop", "--fixture", "--provider=x"], {
        runCycle,
      }),
    ).resolves.toBeUndefined();

    expect(runCycle).toHaveBeenCalledTimes(1);
    expect(stdout.some((line) => line.includes("openbento_worker_run_once"))).toBe(
      true,
    );
    const telemetryLine = stdout.find((line) => line.startsWith("{"));
    expect(telemetryLine).toBeDefined();
    const telemetry = JSON.parse(String(telemetryLine)) as {
      runMode: string;
      xHttpRequests: number;
    };
    expect(telemetry.runMode).toBe("once");
    expect(telemetry.xHttpRequests).toBe(0);
    expect(delaySpy).not.toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Function),
    );

    writeSpy.mockRestore();
    delaySpy.mockRestore();
  });

  it("worker=true runOnce=true X=false performs one tick with zero X requests", async () => {
    process.env.OPENBENTO_WORKER_ENABLED = "true";
    process.env.OPENBENTO_WORKER_RUN_ONCE = "true";
    process.env.X_PROVIDER_ENABLED = "false";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const runCycle = vi.fn(async () => ({ ...EMPTY_CYCLE, xHttpRequests: 0 }));

    await main(["--loop", "--fixture", "--provider=x"], { runCycle });
    expect(runCycle).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("worker tick telemetry", () => {
  it("aggregates pipeline counters and omits secrets", () => {
    const telemetry = buildWorkerTickTelemetry({
      provider: "x-api-v2",
      runMode: "once",
      includeWatchBots: true,
      result: {
        ...EMPTY_CYCLE,
        watchBotsLoaded: 2,
        processed: 1,
        providerEligibleWatchBots: 1,
        cardsCreated: 0,
        discovered: 10,
        normalized: 10,
        novel: 10,
        rejectedRelevance: 10,
        xHttpRequests: 1,
        candidatesEligible: 0,
        selected: 0,
        cycles: [
          {
            watchBotId: "566ba9b6-22bf-4c15-8abe-9f20b5496583",
            skipped: false,
            items: [],
            stats: {
              discovered: 10,
              normalized: 10,
              novel: 10,
              duplicates: 0,
              rejectedRelevance: 10,
              errors: 0,
              cardsCreated: 0,
              candidatesEligible: 0,
              selected: 0,
            },
            topOutcome: "rejected_relevance",
            cardsCreated: 0,
            durationMs: 12,
          },
        ],
      },
    });

    expect(telemetry).toMatchObject({
      provider: "x-api-v2",
      watchBotsLoaded: 2,
      watchBotsProcessed: 1,
      providerEligibleWatchBots: 1,
      discovered: 10,
      normalized: 10,
      novel: 10,
      rejectedRelevance: 10,
      cardsCreated: 0,
      xHttpRequests: 1,
      runMode: "once",
    });
    expect(telemetry.watchBots?.[0]).toMatchObject({
      watchBotId: "566ba9b6-22bf-4c15-8abe-9f20b5496583",
      topOutcome: "rejected_relevance",
    });
    expect(() => assertSafeWorkerTelemetry(telemetry)).not.toThrow();
    const serialized = formatWorkerTickTelemetry(telemetry);
    expect(serialized.toLowerCase()).not.toMatch(/bearer|service_role|instruction/);
  });
});

describe("worker secret separation", () => {
  it("does not place worker secrets on NEXT_PUBLIC code paths", () => {
    expect(source).not.toMatch(/NEXT_PUBLIC_.*X_BEARER|X_BEARER_TOKEN.*NEXT_PUBLIC/);
    expect(source).not.toMatch(/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE/);
    expect(source).toMatch(/createWorkerDomainStore/);
  });
});
