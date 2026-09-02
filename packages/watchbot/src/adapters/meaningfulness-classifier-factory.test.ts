import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  createConfiguredMeaningfulnessClassifier,
  resolveMeaningfulnessProvider,
} from "./meaningfulness-classifier-factory";
import { createModelMeaningfulnessClassifier } from "./meaningfulness-classifier";
import { createOpenAIMeaningfulnessClassifier } from "./openai-meaningfulness-classifier";

function envelope(judgment: { meaningful: boolean; importanceScore: number }) {
  return {
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify(judgment),
          },
        ],
      },
    ],
  };
}

function recordingFetch() {
  const urls: string[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request) => {
    urls.push(String(url));
    return new Response(
      JSON.stringify(envelope({ meaningful: true, importanceScore: 0.5 })),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  return { fetchImpl, urls };
}

const BOTH_KEYS = {
  WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED: "true",
  OPENAI_API_KEY: "test-openai-key",
  XAI_API_KEY: "test-xai-key",
  GROK_API_KEY: "test-grok-key",
};

describe("meaningfulness provider selector", () => {
  it("treats missing, empty, and unknown provider as none", () => {
    expect(resolveMeaningfulnessProvider({})).toBe("none");
    expect(resolveMeaningfulnessProvider({ WATCHBOT_MEANINGFULNESS_PROVIDER: "" })).toBe(
      "none",
    );
    expect(
      resolveMeaningfulnessProvider({ WATCHBOT_MEANINGFULNESS_PROVIDER: "auto" }),
    ).toBe("none");
    expect(
      resolveMeaningfulnessProvider({ WATCHBOT_MEANINGFULNESS_PROVIDER: "openai" }),
    ).toBe("openai");
    expect(
      resolveMeaningfulnessProvider({ WATCHBOT_MEANINGFULNESS_PROVIDER: "xai" }),
    ).toBe("xai");
    expect(
      resolveMeaningfulnessProvider({ WATCHBOT_MEANINGFULNESS_PROVIDER: "none" }),
    ).toBe("none");
  });

  it("returns null when the env gate is off even if both keys and a provider exist", () => {
    const { fetchImpl } = recordingFetch();
    expect(
      createConfiguredMeaningfulnessClassifier(
        { fetchImpl },
        {
          ...BOTH_KEYS,
          WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED: "false",
          WATCHBOT_MEANINGFULNESS_PROVIDER: "openai",
        },
      ),
    ).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns null when provider is unset even if both vendor keys exist", () => {
    const { fetchImpl } = recordingFetch();
    expect(
      createConfiguredMeaningfulnessClassifier({ fetchImpl }, BOTH_KEYS),
    ).toBeNull();
    expect(
      createConfiguredMeaningfulnessClassifier(
        { fetchImpl },
        { ...BOTH_KEYS, WATCHBOT_MEANINGFULNESS_PROVIDER: "none" },
      ),
    ).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns null when OpenAI is selected but OPENAI_API_KEY is missing (no xAI fallback)", () => {
    const { fetchImpl } = recordingFetch();
    expect(
      createConfiguredMeaningfulnessClassifier(
        { fetchImpl },
        {
          WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED: "true",
          WATCHBOT_MEANINGFULNESS_PROVIDER: "openai",
          XAI_API_KEY: "test-xai-key",
        },
      ),
    ).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns null when xAI is selected but xAI/Grok key is missing (no OpenAI fallback)", () => {
    const { fetchImpl } = recordingFetch();
    expect(
      createConfiguredMeaningfulnessClassifier(
        { fetchImpl },
        {
          WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED: "true",
          WATCHBOT_MEANINGFULNESS_PROVIDER: "xai",
          OPENAI_API_KEY: "test-openai-key",
        },
      ),
    ).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("calls OpenAI only when provider=openai even if an xAI key is also present", async () => {
    const { fetchImpl, urls } = recordingFetch();
    const classifier = createConfiguredMeaningfulnessClassifier(
      { fetchImpl },
      { ...BOTH_KEYS, WATCHBOT_MEANINGFULNESS_PROVIDER: "openai" },
    );
    expect(classifier).not.toBeNull();
    expect((classifier as { vendor?: string }).vendor).toBe("openai");
    await classifier?.classify({
      title: "Canada files a lawsuit over the Lake Ontario rename",
      snippet: "Canada filed in federal court.",
      sourceType: "news",
      canonicalUrl: "https://news.example.com/lawsuit",
      instruction: "Monitor the lake rename",
    });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("api.openai.com");
    expect(urls[0]).not.toContain("api.x.ai");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("calls xAI only when provider=xai even if an OpenAI key is also present", async () => {
    const { fetchImpl, urls } = recordingFetch();
    const classifier = createConfiguredMeaningfulnessClassifier(
      { fetchImpl },
      { ...BOTH_KEYS, WATCHBOT_MEANINGFULNESS_PROVIDER: "xai" },
    );
    expect(classifier).not.toBeNull();
    expect((classifier as { vendor?: string }).vendor).toBe("xai-grok");
    await classifier?.classify({
      title: "Canada files a lawsuit over the Lake Ontario rename",
      snippet: "Canada filed in federal court.",
      sourceType: "news",
      canonicalUrl: "https://news.example.com/lawsuit",
      instruction: "Monitor the lake rename",
    });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("api.x.ai");
    expect(urls[0]).not.toContain("api.openai.com");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("keeps the xAI-only constructor working for Slice D compat", () => {
    const xai = createModelMeaningfulnessClassifier(
      { enabled: true, apiKey: "test-not-a-secret", fetchImpl: recordingFetch().fetchImpl },
    );
    const openai = createOpenAIMeaningfulnessClassifier(
      { enabled: true, apiKey: "test-not-a-secret", fetchImpl: recordingFetch().fetchImpl },
    );
    expect(xai?.vendor).toBe("xai-grok");
    expect(openai?.vendor).toBe("openai");
  });

  it("keeps the committed env example gate off and provider none", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const example = readFileSync(join(here, "../../../../.env.example"), "utf8");
    expect(example).toMatch(/^WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED=false$/m);
    expect(example).not.toMatch(/^WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED=true$/m);
    expect(example).toMatch(/^WATCHBOT_MEANINGFULNESS_PROVIDER=none$/m);
    expect(example).toMatch(/^OPENAI_MEANINGFULNESS_MODEL=gpt-5\.6-luna$/m);
    expect(example).toMatch(/^OPENAI_API_KEY=$/m);
  });
});
