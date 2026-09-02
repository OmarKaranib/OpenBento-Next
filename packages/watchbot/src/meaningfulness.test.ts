import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  PASSTHROUGH_IMPORTANCE,
  PASSTHROUGH_MEANINGFULNESS_CLASSIFIER,
  PASSTHROUGH_MEANINGFULNESS_JUDGMENT,
  createFixtureMeaningfulnessClassifier,
  isMeaningfulDevelopment,
  judgeRepresentatives,
  normalizeImportanceScore,
  selectMeaningfulDevelopments,
  toMeaningfulnessInput,
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
        title: "オンタリオ湖をレイク・アメリカに改名する公式発表",
        meaningful: true,
        importanceScore: 0.9,
      },
      {
        title: "إعلان رسمي لإعادة تسمية بحيرة أونتاريو",
        meaningful: true,
        importanceScore: 0.9,
      },
    ]);

    const ascii = await classifier.classify(
      input({ title: "Ontario lake news brief" }),
    );
    const japanese = await classifier.classify(
      input({ title: "オンタリオ湖をレイク・アメリカに改名する公式発表" }),
    );
    const arabic = await classifier.classify(
      input({ title: "إعلان رسمي لإعادة تسمية بحيرة أونتاريو" }),
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
  });

  it("does not mutate the representative list", async () => {
    const pool = [
      { arrivalIndex: 0, relevanceScore: 0.5, noveltyScore: 1 },
    ];
    const snapshot = [...pool];
    await judgeRepresentatives(pool, () => input(), PASSTHROUGH_MEANINGFULNESS_CLASSIFIER);
    expect(pool).toEqual(snapshot);
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

  it("does not use script/language to break multilingual ties — scores only", () => {
    const japanese = {
      arrivalIndex: 1,
      relevanceScore: 0.8,
      noveltyScore: 1,
      importanceScore: 0.9,
      title: "オンタリオ湖をレイク・アメリカに改名する公式発表",
    };
    const arabic = {
      arrivalIndex: 2,
      relevanceScore: 0.8,
      noveltyScore: 1,
      importanceScore: 0.9,
      title: "إعلان رسمي لإعادة تسمية بحيرة أونتاريو",
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
