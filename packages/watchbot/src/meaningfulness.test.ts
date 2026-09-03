import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  JUDGE_DEFAULT_CONCURRENCY,
  PASSTHROUGH_IMPORTANCE,
  PASSTHROUGH_MEANINGFULNESS_CLASSIFIER,
  PASSTHROUGH_MEANINGFULNESS_JUDGMENT,
  classifierStageDetail,
  createFixtureMeaningfulnessClassifier,
  failClosedMeaningfulnessJudgment,
  formatImportanceForDetail,
  isMeaningfulDevelopment,
  judgeRepresentatives,
  normalizeImportanceScore,
  selectMeaningfulDevelopments,
  toMeaningfulnessInput,
  type MeaningfulnessClassifier,
  type MeaningfulnessInput,
  type MeaningfulnessJudgment,
} from "./meaningfulness";
import {
  compareCandidates,
  selectCandidates,
  type RankableCandidate,
} from "./select-candidates";

function input(partial: Partial<MeaningfulnessInput> = {}): MeaningfulnessInput {
  return {
    title: "Officials debate renaming Lake Ontario",
    snippet: "A proposal prompted official statements.",
    sourceType: "news",
    canonicalUrl: "https://news.example.com/ontario",
    instruction: "Monitor meaningful developments around Lake Ontario",
    ...partial,
  };
}

describe("meaningfulness contract", () => {
  it("passthrough treats every representative as meaningful with unscored importance", async () => {
    const judgment = await PASSTHROUGH_MEANINGFULNESS_CLASSIFIER.classify(
      input({ title: "just chatting about the lake again" }),
    );
    expect(judgment).toEqual(PASSTHROUGH_MEANINGFULNESS_JUDGMENT);
    expect(isMeaningfulDevelopment(judgment)).toBe(true);
    expect(judgment.importanceScore).toBe(PASSTHROUGH_IMPORTANCE);
  });

  it("fixture classifier distinguishes relevant chatter from a genuine development", async () => {
    const classifier = createFixtureMeaningfulnessClassifier([
      {
        title: "people are talking about the lake rename again",
        meaningful: false,
        importanceScore: 0.1,
      },
      {
        title: "Canada files a lawsuit over the Lake Ontario rename",
        meaningful: true,
        importanceScore: 0.92,
      },
    ]);

    const chatter = await classifier.classify(
      input({ title: "people are talking about the lake rename again" }),
    );
    const development = await classifier.classify(
      input({ title: "Canada files a lawsuit over the Lake Ontario rename" }),
    );

    expect(isMeaningfulDevelopment(chatter)).toBe(false);
    expect(isMeaningfulDevelopment(development)).toBe(true);
    expect(development.importanceScore).toBeGreaterThan(chatter.importanceScore);
  });

  it("does not penalize multilingual/non-ASCII titles; scores come from the classifier", async () => {
    const classifier = createFixtureMeaningfulnessClassifier([
      {
        title: "Ontario lake news brief",
        meaningful: true,
        importanceScore: 0.2,
      },
      {
        title: "\u30AA\u30F3\u30BF\u30EA\u30AA\u6E56\u3092\u30EC\u30A4\u30AF\u30FB\u30A2\u30E1\u30EA\u30AB\u306B\u6539\u540D\u3059\u308B\u516C\u5F0F\u767A\u8868",
        meaningful: true,
        importanceScore: 0.9,
      },
      {
        title: "\u0625\u0639\u0644\u0627\u0646 \u0631\u0633\u0645\u064A \u0644\u0625\u0639\u0627\u062F\u0629 \u062A\u0633\u0645\u064A\u0629 \u0628\u062D\u064A\u0631\u0629 \u0623\u0648\u0646\u062A\u0627\u0631\u064A\u0648",
        meaningful: true,
        importanceScore: 0.9,
      },
    ]);

    const ascii = await classifier.classify(
      input({ title: "Ontario lake news brief" }),
    );
    const japanese = await classifier.classify(
      input({ title: "\u30AA\u30F3\u30BF\u30EA\u30AA\u6E56\u3092\u30EC\u30A4\u30AF\u30FB\u30A2\u30E1\u30EA\u30AB\u306B\u6539\u540D\u3059\u308B\u516C\u5F0F\u767A\u8868" }),
    );
    const arabic = await classifier.classify(
      input({ title: "\u0625\u0639\u0644\u0627\u0646 \u0631\u0633\u0645\u064A \u0644\u0625\u0639\u0627\u062F\u0629 \u062A\u0633\u0645\u064A\u0629 \u0628\u062D\u064A\u0631\u0629 \u0623\u0648\u0646\u062A\u0627\u0631\u064A\u0648" }),
    );

    expect(japanese.meaningful).toBe(true);
    expect(arabic.meaningful).toBe(true);
    expect(japanese.importanceScore).toBeGreaterThan(ascii.importanceScore);
    expect(arabic.importanceScore).toBe(japanese.importanceScore);
  });

  it("clamps importance into [0, 1] and treats non-finite as 0", () => {
    expect(normalizeImportanceScore(-2)).toBe(0);
    expect(normalizeImportanceScore(0)).toBe(0);
    expect(normalizeImportanceScore(0.42)).toBe(0.42);
    expect(normalizeImportanceScore(2)).toBe(1);
    expect(normalizeImportanceScore(Number.NaN)).toBe(0);
    expect(normalizeImportanceScore(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("sanitizes untrusted title/snippet/URL and never evals source text", () => {
    const built = toMeaningfulnessInput(
      {
        title: "  Lake\u0000 Ontario  ",
        snippet: "<script>eval('nope')</script> officials spoke",
        sourceType: "news",
        canonicalUrl: "https://news.example.com/ontario",
      },
      "Monitor the story",
    );
    expect(built.title).toBe("Lake Ontario");
    expect(built.snippet).not.toMatch(/\u0000/);
    expect(built.canonicalUrl).toBe("https://news.example.com/ontario");
    expect(built.instruction).toBe("Monitor the story");
  });

  it("fail-closes a representative when the classifier throws", async () => {
    const classifier = {
      classify: () => {
        throw new Error("model_unavailable");
      },
    };
    const [judged] = await judgeRepresentatives(
      [{ arrivalIndex: 0, relevanceScore: 0.9, noveltyScore: 1 }],
      () => input(),
      classifier,
    );
    expect(judged?.meaningful).toBe(false);
    expect(judged?.importanceScore).toBe(0);
    expect(judged?.classificationStatus).toBe("error");
  });

  it("operates on clustered representatives only", async () => {
    const classify = vi.fn(
      (item: MeaningfulnessInput): MeaningfulnessJudgment => ({
        meaningful: item.title.includes("lawsuit"),
        importanceScore: item.title.includes("lawsuit") ? 0.8 : 0.2,
      }),
    );
    const representatives = [
      { arrivalIndex: 1, relevanceScore: 0.9, noveltyScore: 1, title: "lawsuit" },
    ];
    const clusteredMember = {
      arrivalIndex: 0,
      relevanceScore: 0.4,
      noveltyScore: 1,
      title: "people are talking about the lake rename again",
    };

    await judgeRepresentatives(
      representatives,
      (candidate) => input({ title: candidate.title }),
      { classify },
    );

    expect(classify).toHaveBeenCalledTimes(1);
    expect(classify.mock.calls[0]?.[0]?.title).toBe("lawsuit");
    expect(classify.mock.calls.some((call) => call[0].title === clusteredMember.title)).toBe(
      false,
    );
  });

  it("excludes not-meaningful representatives from the selection pool", async () => {
    const judged = await judgeRepresentatives(
      [
        { arrivalIndex: 0, relevanceScore: 0.9, noveltyScore: 1, title: "chatter" },
        { arrivalIndex: 1, relevanceScore: 0.4, noveltyScore: 1, title: "lawsuit" },
      ],
      (candidate) => input({ title: candidate.title }),
      createFixtureMeaningfulnessClassifier([
        { title: "chatter", meaningful: false, importanceScore: 0.1 },
        { title: "lawsuit", meaningful: true, importanceScore: 0.7 },
      ]),
    );
    const meaningful = selectMeaningfulDevelopments(judged);
    expect(meaningful).toHaveLength(1);
    expect(meaningful[0]?.title).toBe("lawsuit");
    expect(judged.find((item) => item.title === "chatter")?.meaningful).toBe(false);
    expect(judged.find((item) => item.title === "chatter")?.classificationStatus).toBe(
      "classified",
    );
    expect(judged.find((item) => item.title === "lawsuit")?.classificationStatus).toBe(
      "classified",
    );
  });

  it("does not mutate the representative list", async () => {
    const pool = [
      { arrivalIndex: 0, relevanceScore: 0.5, noveltyScore: 1 },
    ];
    const snapshot = [...pool];
    await judgeRepresentatives(pool, () => input(), PASSTHROUGH_MEANINGFULNESS_CLASSIFIER);
    expect(pool).toEqual(snapshot);
  });

  it("formats classifier stage-event detail without source text", () => {
    expect(formatImportanceForDetail(0.15)).toBe("0.150");
    expect(formatImportanceForDetail(0.9)).toBe("0.900");
    expect(formatImportanceForDetail(1.4)).toBe("1.000");
    expect(
      classifierStageDetail(failClosedMeaningfulnessJudgment("budget_exhausted")),
    ).toBe("not_meaningful:budget_exhausted");
    expect(
      classifierStageDetail({
        meaningful: false,
        importanceScore: 0.15,
        classificationStatus: "classified",
      }),
    ).toBe("not_meaningful:classified:importance=0.150");
    expect(
      classifierStageDetail({
        meaningful: true,
        importanceScore: 0.9,
        classificationStatus: "classified",
      }),
    ).toBe("meaningful:classified:importance=0.900");
    expect(classifierStageDetail(failClosedMeaningfulnessJudgment("error"))).toBe(
      "not_meaningful:error",
    );
  });

  it("treats omitted classificationStatus as classified", async () => {
    const [judged] = await judgeRepresentatives(
      [{ arrivalIndex: 0, relevanceScore: 0.9, noveltyScore: 1 }],
      () => input(),
      {
        classify: () => ({ meaningful: false, importanceScore: 0.22 }),
      },
    );
    expect(judged?.classificationStatus).toBe("classified");
    expect(
      classifierStageDetail({
        meaningful: judged?.meaningful ?? false,
        importanceScore: judged?.importanceScore ?? 0,
        classificationStatus: judged?.classificationStatus,
      }),
    ).toBe("not_meaningful:classified:importance=0.220");
  });
});

describe("importance ranking comparator", () => {
  function candidate(
    arrivalIndex: number,
    relevanceScore: number,
    noveltyScore: number,
    importanceScore?: number,
  ): RankableCandidate {
    return { arrivalIndex, relevanceScore, noveltyScore, importanceScore };
  }

  it("lets high-importance outrank low-importance even when relevance is weaker", () => {
    const earlierRelevantLow = candidate(0, 0.95, 1, 0.2);
    const laterWeakerRelevanceHigh = candidate(1, 0.4, 1, 0.9);
    expect(selectCandidates([earlierRelevantLow, laterWeakerRelevanceHigh])).toEqual(
      [laterWeakerRelevanceHigh, earlierRelevantLow],
    );
    expect(compareCandidates(laterWeakerRelevanceHigh, earlierRelevantLow)).toBeLessThan(
      0,
    );
  });

  it("breaks equal-importance ties with Slice A order (relevance, novelty, arrival)", () => {
    const earlierWeaker = candidate(0, 0.2, 1, 0.5);
    const laterStronger = candidate(1, 0.9, 1, 0.5);
    expect(selectCandidates([earlierWeaker, laterStronger])).toEqual([
      laterStronger,
      earlierWeaker,
    ]);

    const first = candidate(0, 0.5, 0.8, 0.4);
    const second = candidate(1, 0.5, 0.8, 0.4);
    const third = candidate(2, 0.5, 0.8, 0.4);
    expect(selectCandidates([third, first, second])).toEqual([first, second, third]);
    expect(selectCandidates([third, first, second])).toEqual(
      selectCandidates([second, third, first]),
    );
  });

  it("treats missing importance as passthrough 0 so existing ranking is unchanged", () => {
    const earlierWeaker = candidate(0, 0.2, 1);
    const laterStronger = candidate(1, 0.9, 1);
    expect(selectCandidates([earlierWeaker, laterStronger])).toEqual([
      laterStronger,
      earlierWeaker,
    ]);
    expect(compareCandidates(laterStronger, candidate(1, 0.9, 1, 0))).toBe(0);
  });

  it("does not use script/language to break multilingual ties \u2014 scores only", () => {
    const japanese = {
      arrivalIndex: 1,
      relevanceScore: 0.8,
      noveltyScore: 1,
      importanceScore: 0.9,
      title: "\u30AA\u30F3\u30BF\u30EA\u30AA\u6E56\u3092\u30EC\u30A4\u30AF\u30FB\u30A2\u30E1\u30EA\u30AB\u306B\u6539\u540D\u3059\u308B\u516C\u5F0F\u767A\u8868",
    };
    const arabic = {
      arrivalIndex: 2,
      relevanceScore: 0.8,
      noveltyScore: 1,
      importanceScore: 0.9,
      title: "\u0625\u0639\u0644\u0627\u0646 \u0631\u0633\u0645\u064A \u0644\u0625\u0639\u0627\u062F\u0629 \u062A\u0633\u0645\u064A\u0629 \u0628\u062D\u064A\u0631\u0629 \u0623\u0648\u0646\u062A\u0627\u0631\u064A\u0648",
    };
    const asciiChatter = {
      arrivalIndex: 0,
      relevanceScore: 0.95,
      noveltyScore: 1,
      importanceScore: 0.1,
      title: "Ontario lake news brief",
    };
    const selected = selectCandidates([asciiChatter, japanese, arabic]);
    expect(selected.map((item) => item.title)).toEqual([
      japanese.title,
      arabic.title,
      asciiChatter.title,
    ]);
  });
});

describe("bounded-concurrent judgeRepresentatives", () => {
  function rep(i: number) {
    return {
      arrivalIndex: i,
      relevanceScore: 0.9,
      noveltyScore: 1,
      title: `rep-${i}`,
    };
  }

  it("max in-flight classifier calls never exceeds configured concurrency", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const classifier: MeaningfulnessClassifier = {
      async classify() {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 10));
        inFlight--;
        return { meaningful: true, importanceScore: 0.5 };
      },
    };
    await judgeRepresentatives(
      Array.from({ length: 8 }, (_, i) => rep(i)),
      (c) => input({ title: c.title }),
      classifier,
      3,
    );
    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("output order equals input order despite out-of-order completion", async () => {
    const delays = [30, 5, 20, 10, 25, 8, 15, 35];
    const reps = delays.map((_, i) => rep(i));
    const classifier: MeaningfulnessClassifier = {
      async classify(inp) {
        const idx = Number(inp.title.split("-")[1]);
        await new Promise((r) => setTimeout(r, delays[idx]!));
        return { meaningful: true, importanceScore: idx / 10 };
      },
    };
    const judged = await judgeRepresentatives(reps, (c) => input({ title: c.title }), classifier, 4);
    expect(judged.map((j) => j.arrivalIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("8 representatives no longer execute strictly serially", async () => {
    let maxInFlight = 0;
    let inFlight = 0;
    const classifier: MeaningfulnessClassifier = {
      async classify() {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return { meaningful: true, importanceScore: 0.5 };
      },
    };
    await judgeRepresentatives(
      Array.from({ length: 8 }, (_, i) => rep(i)),
      (c) => input({ title: c.title }),
      classifier,
    );
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("budget exhaustion still prevents HTTP attempts under concurrency", async () => {
    let callCount = 0;
    const classifier: MeaningfulnessClassifier = {
      async classify() {
        callCount++;
        if (callCount > 3) {
          return failClosedMeaningfulnessJudgment("budget_exhausted");
        }
        await new Promise((r) => setTimeout(r, 5));
        return { meaningful: true, importanceScore: 0.8 };
      },
    };
    const judged = await judgeRepresentatives(
      Array.from({ length: 8 }, (_, i) => rep(i)),
      (c) => input({ title: c.title }),
      classifier,
      4,
    );
    expect(judged.filter((j) => j.classificationStatus === "budget_exhausted")).toHaveLength(5);
    expect(judged.filter((j) => j.meaningful)).toHaveLength(3);
  });

  it("classifierCalls counters remain exact", async () => {
    let calls = 0;
    let meaningful = 0;
    let notMeaningful = 0;
    const classifier: MeaningfulnessClassifier = {
      async classify(inp) {
        calls++;
        const m = inp.title.includes("rep-0") || inp.title.includes("rep-3");
        if (m) meaningful++;
        else notMeaningful++;
        await new Promise((r) => setTimeout(r, 5));
        return { meaningful: m, importanceScore: m ? 0.8 : 0.2 };
      },
    };
    const reps = Array.from({ length: 8 }, (_, i) => rep(i));
    const judged = await judgeRepresentatives(reps, (c) => input({ title: c.title }), classifier, 4);
    expect(calls).toBe(8);
    expect(judged.filter((j) => j.meaningful).length).toBe(meaningful);
    expect(judged.filter((j) => !j.meaningful).length).toBe(notMeaningful);
  });

  it("provider error is isolated per representative", async () => {
    const classifier: MeaningfulnessClassifier = {
      async classify(inp) {
        if (inp.title === "rep-2") throw new Error("provider_down");
        await new Promise((r) => setTimeout(r, 5));
        return { meaningful: true, importanceScore: 0.7 };
      },
    };
    const judged = await judgeRepresentatives(
      Array.from({ length: 5 }, (_, i) => rep(i)),
      (c) => input({ title: c.title }),
      classifier,
      3,
    );
    expect(judged[2]!.meaningful).toBe(false);
    expect(judged[2]!.classificationStatus).toBe("error");
    expect(judged.filter((j) => j.meaningful)).toHaveLength(4);
    expect(judged.filter((j) => j.classificationStatus === "classified")).toHaveLength(4);
  });

  it("deterministic ranking/select output unchanged", async () => {
    const classifier = createFixtureMeaningfulnessClassifier([
      { title: "rep-0", meaningful: false, importanceScore: 0.1 },
      { title: "rep-1", meaningful: true, importanceScore: 0.9 },
      { title: "rep-2", meaningful: true, importanceScore: 0.5 },
      { title: "rep-3", meaningful: false, importanceScore: 0.3 },
    ]);
    const reps = Array.from({ length: 4 }, (_, i) => rep(i));
    const judged = await judgeRepresentatives(reps, (c) => input({ title: c.title }), classifier, 4);
    const meaningful = selectMeaningfulDevelopments(judged);
    expect(meaningful.map((m) => m.title)).toEqual(["rep-1", "rep-2"]);
    expect(judged.map((j) => j.arrivalIndex)).toEqual([0, 1, 2, 3]);
  });

  it("default concurrency is 4", () => {
    expect(JUDGE_DEFAULT_CONCURRENCY).toBe(4);
  });

  it("OpenAI mocked adapter path works under concurrency", async () => {
    let calls = 0;
    const openaiMock: MeaningfulnessClassifier = {
      async classify(inp) {
        calls++;
        await new Promise((r) => setTimeout(r, 5));
        return { meaningful: inp.title !== "rep-1", importanceScore: 0.6, classificationStatus: "classified" };
      },
    };
    const reps = Array.from({ length: 6 }, (_, i) => rep(i));
    const judged = await judgeRepresentatives(reps, (c) => input({ title: c.title }), openaiMock, 3);
    expect(calls).toBe(6);
    expect(judged[1]!.meaningful).toBe(false);
    expect(judged.map((j) => j.arrivalIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("xAI mocked adapter path works under concurrency", async () => {
    let calls = 0;
    const xaiMock: MeaningfulnessClassifier = {
      async classify(inp) {
        calls++;
        await new Promise((r) => setTimeout(r, 5));
        return { meaningful: inp.title !== "rep-3", importanceScore: 0.7, classificationStatus: "classified" };
      },
      startCycle() { /* xAI adapters have startCycle */ },
    };
    const reps = Array.from({ length: 6 }, (_, i) => rep(i));
    const judged = await judgeRepresentatives(reps, (c) => input({ title: c.title }), xaiMock, 3);
    expect(calls).toBe(6);
    expect(judged[3]!.meaningful).toBe(false);
    expect(judged.map((j) => j.arrivalIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("meaningfulness source boundary", () => {
  it("does not encode ASCII/English lexical gates or vendor adapters", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "meaningfulness.ts"), "utf8");
    expect(src).not.toMatch(/XAI_API_KEY|GROK_API_KEY|OPENAI_API_KEY|X_BEARER_TOKEN|api\.x\.com|api\.openai\.com/i);
    expect(src).not.toMatch(/from\s+["'][^"']*(?:adapters\/(?:x|grok|openai))[^"']*["']/);
    expect(src).not.toMatch(/split\(\/\^\[a-z0-9/i);
    expect(src).not.toMatch(
      /(?:announce|confirm|breaking|lawsuit|officials|developments?)\s*[:=]/i,
    );
    expect(src).toMatch(/PASSTHROUGH_MEANINGFULNESS_CLASSIFIER/);
  });
});
