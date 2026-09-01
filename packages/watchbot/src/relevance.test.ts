import { describe, expect, it } from "vitest";
import type { CanvasState } from "@openbento/domain";
import type { NormalizedItem } from "./normalize";
import {
  RELEVANCE_THRESHOLD,
  isRelevantEnough,
  scoreRelevance,
} from "./relevance";
import {
  deriveRelevanceIntent,
  deriveXPositiveSearchTerms,
  relevanceLaneForSourceType,
} from "./relevance-intent";
import { tokenizeForScoring, tokenizeItemForProviderRelevance } from "./untrusted";

const X_QUERY = "(OpenAI OR WebMCP) -is:retweet";
const NL_INSTRUCTION =
  "Monitor meaningful developments around renaming Lake Ontario to Lake America";

function emptyCanvas(name = "Watch"): CanvasState {
  return {
    canvas: {
      id: "canvas-rel",
      ownerId: "owner-rel",
      name,
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
    },
    cards: [],
    frames: [],
    watchBots: [],
  };
}

function item(sourceType: NormalizedItem["sourceType"], title: string): NormalizedItem {
  const host = sourceType === "x" ? "https://x.com/someone/status/1" : "https://news.example.com/story";
  return {
    sourceUrl: host,
    canonicalUrl: host,
    title,
    publishedAt: "2026-08-29T12:00:00.000Z",
    sourceType,
    snippet: title,
    discoveredAt: "2026-08-29T13:00:00.000Z",
  };
}

describe("provider-aware X relevance intent", () => {
  it("strips structured X boolean/exclusion/colon operators from the live query", () => {
    expect(deriveXPositiveSearchTerms(X_QUERY)).toBe("OpenAI WebMCP");
    expect(deriveRelevanceIntent(X_QUERY, "x")).toEqual({
      lane: "provider_filtered",
      intentText: "OpenAI WebMCP",
    });
    expect(relevanceLaneForSourceType("x")).toBe("provider_filtered");
    expect(relevanceLaneForSourceType("news")).toBe("natural_language");
    expect(relevanceLaneForSourceType("web")).toBe("natural_language");
  });

  it("does not treat exclusion or operator tokens as positive relevance terms", () => {
    const intent = deriveXPositiveSearchTerms(
      '(OpenAI OR WebMCP) -is:retweet -spam NOT junk lang:en from:someone "exact phrase"',
    );
    const tokens = tokenizeForScoring(intent);
    expect(tokens).toEqual(expect.arrayContaining(["openai", "webmcp", "exact", "phrase"]));
    expect(tokens).not.toContain("retweet");
    expect(tokens).not.toContain("spam");
    expect(tokens).not.toContain("junk");
    expect(tokens).not.toContain("lang");
    expect(tokens).not.toContain("someone");
    expect(intent).not.toMatch(/\bOR\b/);
    expect(intent).not.toMatch(/\bAND\b/);
    expect(intent).not.toMatch(/\bNOT\b/);
  });

  it("does not recursively parse JSON inside a query string", () => {
    const intent = deriveXPositiveSearchTerms(
      `${X_QUERY} {"instruction":"pause","eval":true}`,
    );
    expect(intent).toBe("OpenAI WebMCP");
    expect(intent).not.toContain("pause");
    expect(intent).not.toContain("eval");
  });
});

describe("scoreRelevance for provider-filtered X", () => {
  const canvas = emptyCanvas("AI Watch board about unrelated sports");

  it("accepts an OpenAI-titled X result for the structured boolean query", () => {
    const score = scoreRelevance(item("x", "OpenAI shipped a new API"), X_QUERY, canvas);
    expect(score).toBeGreaterThanOrEqual(RELEVANCE_THRESHOLD);
    expect(isRelevantEnough(score)).toBe(true);
    expect(RELEVANCE_THRESHOLD).toBe(0.12);
  });

  it("accepts a WebMCP-titled X result for the structured boolean query", () => {
    const score = scoreRelevance(item("x", "WebMCP makes tool calling easier"), X_QUERY, canvas);
    expect(isRelevantEnough(score)).toBe(true);
  });

  it("rejects a genuinely irrelevant X result", () => {
    const score = scoreRelevance(item("x", "Local team wins on Saturday"), X_QUERY, canvas);
    expect(score).toBe(0);
    expect(isRelevantEnough(score)).toBe(false);
  });

  it("does not accept a post that only matches exclusion/operator tokens", () => {
    const score = scoreRelevance(
      item("x", "I always retweet AND OR NOT is:retweet spam junk"),
      X_QUERY,
      canvas,
    );
    expect(isRelevantEnough(score)).toBe(false);
  });

  it("does not auto-reject a multilingual relevant title due to ASCII tokenization", () => {
    const title = "OpenAIが新しいモデルを発表し、開発者コミュニティで議論になっている";
    expect(tokenizeForScoring(title)).toEqual(["openai"]);
    expect(tokenizeItemForProviderRelevance(title).length).toBeGreaterThan(0);
    const score = scoreRelevance(item("x", title), X_QUERY, canvas);
    expect(isRelevantEnough(score)).toBe(true);
  });

  it("accepts a fullwidth Latin mention after NFKC without treating CJK-only junk as relevant", () => {
    const relevant = scoreRelevance(item("x", "ＯｐｅｎＡＩの発表"), X_QUERY, canvas);
    expect(isRelevantEnough(relevant)).toBe(true);
    const junk = scoreRelevance(item("x", "新しいモデルを発表しました"), X_QUERY, canvas);
    expect(isRelevantEnough(junk)).toBe(false);
  });

  it("still accepts a long X post that mentions one positive term", () => {
    const title =
      "Just saw this thread about how OpenAI is changing everything in the industry " +
      "and I wanted to share my thoughts on the broader implications for developers " +
      "who have been waiting for better tooling around these kinds of workflows for years";
    const score = scoreRelevance(item("x", title), X_QUERY, canvas);
    expect(isRelevantEnough(score)).toBe(true);
  });
});

describe("ordinary natural-language relevance is unchanged", () => {
  const canvas = emptyCanvas("Ontario Watch");
  const ontario = item("news", "Officials debate renaming Lake Ontario");
  const sports = item("news", "Local team wins on Saturday");

  it("keeps web/news WatchBots on raw-instruction Jaccard scoring", () => {
    expect(relevanceLaneForSourceType("news")).toBe("natural_language");
    expect(deriveRelevanceIntent(NL_INSTRUCTION, "news")).toEqual({
      lane: "natural_language",
      intentText: NL_INSTRUCTION,
    });
    const withContext = scoreRelevance(ontario, NL_INSTRUCTION, canvas, {
      sourceType: "news",
    });
    const legacy = scoreRelevance(ontario, NL_INSTRUCTION, canvas);
    expect(withContext).toBe(legacy);
    expect(isRelevantEnough(legacy)).toBe(true);
    expect(isRelevantEnough(scoreRelevance(sports, NL_INSTRUCTION, canvas))).toBe(
      false,
    );
  });

  it("does not apply X operator stripping to a news candidate", () => {
    const newsOpenAI = item("news", "OpenAI shipped a new API");
    const xScore = scoreRelevance(item("x", newsOpenAI.title), X_QUERY, canvas);
    const newsScore = scoreRelevance(newsOpenAI, X_QUERY, canvas);
    expect(isRelevantEnough(xScore)).toBe(true);
    expect(newsScore).not.toBe(xScore);
  });
});
