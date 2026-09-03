import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { WatchBotSourceType } from "@openbento/domain";
import {
  OPENAI_API_BASE_URL_DEFAULT,
  OPENAI_WEB_MODEL_DEFAULT,
  OPENAI_WEB_SOURCE_PROVIDER_LIMITS,
  buildDiscoveryPrompt,
  createOpenAIWebSourceProvider,
  openaiWebMaxRequestsPerCycle,
  openaiWebMaxRequestsPerTick,
  openaiWebMaxResultsPerCycle,
  openaiWebModel,
  openaiWebTimeoutMs,
} from "./openai-web";
import { extractDiscoveredItems } from "./web-news-items";

function envelopeWithItems(items: unknown): unknown {
  return {
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify(items),
          },
        ],
      },
    ],
  };
}

function mockFetch(
  body: unknown,
  init?: { status?: number; delayMs?: number },
): typeof fetch {
  return (async (_url, requestInit) => {
    if (init?.delayMs && requestInit?.signal) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, init.delayMs);
        requestInit.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    }
    return new Response(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

const discoverInput = {
  canvasId: "c1",
  watchBotId: "w1",
  instruction: "Monitor Lake Ontario",
  sourceTypes: ["web", "news"] as WatchBotSourceType[],
};

describe("OpenAI web/news SourceProvider gate", () => {
  it("is unused without the env gate and does not require network", () => {
    const fetchImpl = vi.fn(mockFetch(envelopeWithItems([])));
    expect(createOpenAIWebSourceProvider({ fetchImpl }, {})).toBeNull();
    expect(
      createOpenAIWebSourceProvider(
        { apiKey: "test-not-a-secret", fetchImpl },
        { OPENAI_API_KEY: "test-not-a-secret" },
      ),
    ).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("is unused when the gate is on but OPENAI_API_KEY is missing", () => {
    const fetchImpl = vi.fn();
    expect(
      createOpenAIWebSourceProvider(
        { fetchImpl },
        { WATCHBOT_OPENAI_WEB_PROVIDER_ENABLED: "true" },
      ),
    ).toBeNull();
    expect(
      createOpenAIWebSourceProvider(
        { enabled: true, fetchImpl },
        { OPENAI_API_KEY: "" },
      ),
    ).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("constructs only when enabled and OPENAI_API_KEY is present", () => {
    const provider = createOpenAIWebSourceProvider(
      { fetchImpl: mockFetch(envelopeWithItems([])) },
      {
        WATCHBOT_OPENAI_WEB_PROVIDER_ENABLED: "true",
        OPENAI_API_KEY: "test-not-a-secret",
      },
    );
    expect(provider).not.toBeNull();
    expect(provider?.id).toBe("openai-web");
    expect(provider?.vendor).toBe("openai");
  });

  it("defaults the model to gpt-5.6-luna and allows OPENAI_WEB_MODEL override", () => {
    expect(openaiWebModel({})).toBe(OPENAI_WEB_MODEL_DEFAULT);
    expect(openaiWebModel({ OPENAI_WEB_MODEL: "gpt-5.6-terra" })).toBe(
      "gpt-5.6-terra",
    );
  });

  it("clamps request, result, and timeout bounds", () => {
    expect(openaiWebMaxRequestsPerTick({})).toBe(1);
    expect(
      openaiWebMaxRequestsPerTick({
        WATCHBOT_OPENAI_WEB_MAX_REQUESTS_PER_TICK: "99",
      }),
    ).toBe(OPENAI_WEB_SOURCE_PROVIDER_LIMITS.maxRequestsPerTick);
    expect(openaiWebMaxRequestsPerCycle({})).toBe(1);
    expect(openaiWebMaxResultsPerCycle({})).toBe(10);
    expect(
      openaiWebMaxResultsPerCycle({
        WATCHBOT_OPENAI_WEB_MAX_RESULTS_PER_CYCLE: "999",
      }),
    ).toBe(OPENAI_WEB_SOURCE_PROVIDER_LIMITS.maxResultsPerCycle);
    expect(openaiWebTimeoutMs({})).toBe(15_000);
    expect(
      openaiWebTimeoutMs({ WATCHBOT_OPENAI_WEB_TIMEOUT_MS: "999999" }),
    ).toBe(OPENAI_WEB_SOURCE_PROVIDER_LIMITS.timeoutMs);
  });
});
