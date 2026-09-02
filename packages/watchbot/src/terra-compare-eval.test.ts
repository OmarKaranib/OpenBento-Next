import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  MEANINGFULNESS_CLASSIFIER_INSTRUCTIONS,
  MEANINGFULNESS_JUDGMENT_TEXT_FORMAT,
} from "./adapters/meaningfulness-classifier-protocol";
import {
  TERRA_EVAL_INSTRUCTION,
  TERRA_EVAL_MAX_CALLS,
  TERRA_EVAL_MODEL_DEFAULT,
  TERRA_EVAL_SOURCE_TYPE,
  defaultTerraCompareFixturePath,
  loadTerraCompareFixture,
  resolveTerraEvalModel,
  runTerraCompareEval,
  validateTerraCompareFixture,
  type TerraCompareFixture,
} from "./terra-compare-eval";

const PINNED_TITLES = [
  "New lawsuits target OpenAI over the Tumbler Ridge tragedy — 30 more plaintiffs, including teachers and students, now allege aiding and abetting rather than mere negligence in its handling of early warning signs tied to ChatGPT. This marks a major escalation as OpenAI faces https://t.co/kINyQqBT4D",
  "@Keilthar Tu vis au paradis, dans la vraie vie, même dans la plus riche et organisée des entreprises avec le plus d’employés, c’est le bordel. Alors une boite qui a scale aussi vite que OpenAI je te laisse imaginer.",
  "@MaxForAI @theinformation @OpenAI 所以到底能不能看懂啊 这波澄清完感觉更慌了哈",
  "ChatGPTで複数の事業や案件を進めていると、 「今なに進めてたっけ？」が増えてきました。 そこで、チャットを事業ごとに整理して、次にやることまで一覧できるChrome拡張「ChatBoard」を作りました。 OpenAI API不要・ローカル保存です。 ↓配布はこちら https://t.co/86Umk4T9Ic",
  "@MaxForAI @theinformation @OpenAI 全场都会去转\"2 倍\"，但 \"fragile, and currently trending in a negative direction\" 才是新闻。前沿实验室一把手公开承认可监控性正在变差，这比任何架构八卦都重",
] as const;

const PINNED_URLS = [
  "https://x.com/dailytechonx/status/2095134626800894439",
  "https://x.com/louis4174/status/2095134636074586324",
  "https://x.com/lmx2000/status/2095134611353588178",
  "https://x.com/rakutsune_/status/2095134599471137170",
  "https://x.com/linkcheng94/status/2095134574900920742",
] as const;

function envelopeWithJudgment(judgment: unknown): unknown {
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

function mockFetch(body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

function pinnedFixture(): TerraCompareFixture {
  return {
    label: "X Live Test WatchBot",
    instruction: TERRA_EVAL_INSTRUCTION,
    sourceType: TERRA_EVAL_SOURCE_TYPE,
    candidates: PINNED_URLS.map((url, index) => ({
      url,
      title: PINNED_TITLES[index] ?? "",
    })),
  };
}

describe("Terra compare eval fixture", () => {
  it("pins the five durable X Live Test WatchBot titles verbatim", () => {
    const fixture = loadTerraCompareFixture(defaultTerraCompareFixturePath());
    expect(fixture.instruction).toBe(TERRA_EVAL_INSTRUCTION);
    expect(fixture.sourceType).toBe(TERRA_EVAL_SOURCE_TYPE);
    expect(fixture.candidates).toHaveLength(TERRA_EVAL_MAX_CALLS);
    expect(fixture.candidates.map((item) => item.url)).toEqual([...PINNED_URLS]);
    expect(fixture.candidates.map((item) => item.title)).toEqual([
      ...PINNED_TITLES,
    ]);
    expect(validateTerraCompareFixture(fixture)).toBeUndefined();
    expect(JSON.stringify(fixture)).not.toContain("\u2026");
  });

  it("refuses a fixture whose title still contains a Unicode ellipsis", async () => {
    const fetchImpl = vi.fn(mockFetch({}));
    const fixture = pinnedFixture();
    const first = fixture.candidates[0];
    if (first) {
      first.title = `${first.title}\u2026`;
    }
    const result = await runTerraCompareEval({
      env: { OPENAI_API_KEY: "test-not-a-secret" },
      fixture,
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.error).toMatch(/ellipsis/i);
    expect(result.output).toMatch(/watch_bot_events\.title/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("Terra compare eval fail-closed gates", () => {
  it("fails closed with no fetch when OPENAI_API_KEY is missing or empty", async () => {
    const fetchImpl = vi.fn(mockFetch({}));
    const missing = await runTerraCompareEval({
      env: {},
      fetchImpl,
    });
    const empty = await runTerraCompareEval({
      env: { OPENAI_API_KEY: "" },
      fixture: pinnedFixture(),
      fetchImpl,
    });
    expect(missing.ok).toBe(false);
    expect(missing.exitCode).toBe(1);
    expect(missing.error).toMatch(/OPENAI_API_KEY is missing or empty/);
    expect(missing.output).toMatch(/never invents or fetches secrets/);
    expect(empty.exitCode).toBe(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("Terra compare eval replay", () => {
  it("defaults the harness model to gpt-5.6-terra and honors env overrides", () => {
    expect(resolveTerraEvalModel({})).toBe(TERRA_EVAL_MODEL_DEFAULT);
    expect(TERRA_EVAL_MODEL_DEFAULT).toBe("gpt-5.6-terra");
    expect(
      resolveTerraEvalModel({ OPENAI_MEANINGFULNESS_MODEL: "gpt-5.6-luna" }),
    ).toBe("gpt-5.6-luna");
    expect(
      resolveTerraEvalModel({
        OPENAI_MEANINGFULNESS_MODEL: "gpt-5.6-luna",
        OPENAI_TERRA_EVAL_MODEL: "gpt-5.6-terra-preview",
      }),
    ).toBe("gpt-5.6-terra-preview");
  });

  it("classifies five pinned candidates through the OpenAI adapter with ≤5 mock calls", async () => {
    const fetchImpl = vi.fn((async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        model: string;
        instructions: string;
        input: { role: string; content: string }[];
        text?: { format?: { type?: string; name?: string; strict?: boolean } };
      };
      expect(body.model).toBe("gpt-5.6-terra");
      expect(body.instructions).toBe(MEANINGFULNESS_CLASSIFIER_INSTRUCTIONS);
      expect(body.text).toEqual(MEANINGFULNESS_JUDGMENT_TEXT_FORMAT);
      expect(body.input[0]?.content).toContain(TERRA_EVAL_INSTRUCTION);
      expect(body.input[0]?.content).toContain("sourceType: x");
      return new Response(
        JSON.stringify(
          envelopeWithJudgment({
            meaningful: body.input[0]?.content.includes("Tumbler Ridge"),
            importanceScore: body.input[0]?.content.includes("Tumbler Ridge")
              ? 0.91
              : 0.12,
          }),
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch);

    const result = await runTerraCompareEval({
      env: { OPENAI_API_KEY: "test-not-a-secret" },
      fixture: pinnedFixture(),
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.model).toBe("gpt-5.6-terra");
    expect(fetchImpl).toHaveBeenCalledTimes(TERRA_EVAL_MAX_CALLS);
    expect(result.rows).toHaveLength(5);
    expect(result.rows[0]).toMatchObject({
      index: 1,
      url: PINNED_URLS[0],
      title: PINNED_TITLES[0],
      meaningful: "yes",
      importanceScore: 0.91,
      classificationStatus: "classified",
      provider: "openai",
      model: "gpt-5.6-terra",
    });
    expect(result.rows.slice(1).every((row) => row.meaningful === "no")).toBe(
      true,
    );
    expect(result.output).toMatch(/provider=openai/);
    expect(result.output).toMatch(/model=gpt-5\.6-terra/);
    expect(result.output).toMatch(/budget=5\/5/);
    expect(result.output).toContain(PINNED_URLS[0]);
    expect(result.output).toContain("meaningful: yes");
    expect(result.output).not.toMatch(/test-not-a-secret/);
    expect(result.output).not.toMatch(/You classify whether/);
    expect(result.output).not.toMatch(/SOURCE \(untrusted data/);
    expect(result.output).not.toMatch(/sk-/);
  });

  it("does not import X, the worker cycle, or Card creation", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "terra-compare-eval.ts"), "utf8");
    const cli = readFileSync(
      join(here, "../scripts/terra-compare-eval.ts"),
      "utf8",
    );
    for (const text of [src, cli]) {
      expect(text).not.toMatch(
        /createXSourceProvider|X_BEARER_TOKEN|X_PROVIDER_ENABLED|runWatchBotPipeline|createCard|createWatchBot/,
      );
      expect(text).not.toMatch(/railway|RAILWAY_|supabase/i);
      expect(text).toMatch(/createOpenAIMeaningfulnessClassifier/);
    }
  });
});
