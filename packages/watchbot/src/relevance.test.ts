import { describe, expect, it } from "vitest";
import type { CanvasState, Card } from "@openbento/domain";
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
import {
  jaccardSimilarity,
  tokenizeForScoring,
  tokenizeItemForProviderRelevance,
} from "./untrusted";

const X_QUERY = "(OpenAI OR WebMCP) -is:retweet";
const NL_INSTRUCTION =
  "Monitor meaningful developments around renaming Lake Ontario to Lake America";
const IRAN_MONITOR_INSTRUCTION =
  "Follow important news and meaningful developments about Iran. " +
  "Focus on Iranian government and leadership, nuclear negotiations, " +
  "sanctions, military/security developments, relations with the US, " +
  "Israel, Gulf states and Europe, and major domestic political/economic " +
  "developments. Avoid travel, entertainment and generic history.";

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

function item(
  sourceType: NormalizedItem["sourceType"],
  title: string,
  snippet = title,
): NormalizedItem {
  const host = sourceType === "x" ? "https://x.com/someone/status/1" : "https://news.example.com/story";
  return {
    sourceUrl: host,
    canonicalUrl: host,
    title,
    publishedAt: "2026-08-29T12:00:00.000Z",
    sourceType,
    snippet,
    discoveredAt: "2026-08-29T13:00:00.000Z",
  };
}

/** Titles chosen so they share almost no tokens with the Lake Ontario instruction. */
const UNRELATED_CARD_TITLES = [
  "Chocolate cake recipe with extra cocoa powder",
  "Indoor succulent watering calendar for apartments",
  "Vintage brass telescope repair workshop notes",
  "Jazz piano chord voicings for complete beginners",
  "Wool scarf knitting patterns using circular needles",
  "Urban beekeeping starter kit inventory checklist",
  "Pottery wheel throwing techniques for cylinders",
  "Backyard compost bin temperature log entries",
  "Origami crane folding sequence with extra creases",
  "Sourdough starter feeding schedule for winter",
  "Fountain pen ink comparison on cotton paper",
  "Birdwatching checklist for coastal marsh habitats",
];

function unrelatedCard(index: number, title: string): Card {
  const base = {
    id: `card-unrelated-${index}`,
    canvasId: "canvas-rel",
    position: { x: index * 40, y: 0 },
    size: { width: 320, height: 240 },
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  };
  if (index % 2 === 0) {
    return {
      ...base,
      type: "news",
      payload: {
        provenance: {
          sourceUrl: `https://news.example.com/unrelated-${index}`,
          title,
          publishedAt: "2026-08-28T12:00:00.000Z",
          sourceType: "news",
        },
      },
    };
  }
  return {
    ...base,
    type: "note",
    payload: { text: title },
  };
}

function populatedUnrelatedCanvas(name = "Ontario Watch"): CanvasState {
  const base = emptyCanvas(name);
  return {
    ...base,
    cards: UNRELATED_CARD_TITLES.map((title, index) => unrelatedCard(index, title)),
  };
}

function concatenatedNaturalLanguageScore(
  title: string,
  instruction: string,
  canvas: CanvasState,
): number {
  const contextTokens = tokenizeForScoring(
    [
      instruction,
      canvas.canvas.name,
      ...canvas.cards.map((card) => {
        if (card.type === "note") {
          return card.payload.text;
        }
        if ("provenance" in card.payload) {
          return card.payload.provenance.title;
        }
        return "";
      }),
    ].join(" "),
  );
  const itemTokens = tokenizeForScoring(title);
  if (contextTokens.length === 0 || itemTokens.length === 0) {
    return 0;
  }
  return jaccardSimilarity(itemTokens, contextTokens);
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

  it("rejects when short positive terms strip out to an empty intent", () => {
    const query = "(AI OR ML) -is:retweet";
    expect(deriveXPositiveSearchTerms(query)).toBe("AI ML");
    expect(tokenizeForScoring("AI ML")).toEqual([]);
    const score = scoreRelevance(
      item("x", "Please retweet this AI and ML announcement"),
      query,
      canvas,
    );
    expect(score).toBe(0);
    expect(isRelevantEnough(score)).toBe(false);
  });

  it("rejects an operator-only X query with no positive terms", () => {
    const queries = ["-is:retweet", "OR AND NOT", "( OR ) -is:retweet -is:reply"];
    for (const query of queries) {
      expect(tokenizeForScoring(deriveXPositiveSearchTerms(query))).toEqual([]);
      const score = scoreRelevance(
        item("x", "I always retweet OpenAI and WebMCP news"),
        query,
        canvas,
      );
      expect(score).toBe(0);
      expect(isRelevantEnough(score)).toBe(false);
    }
  });
});

describe("ordinary natural-language relevance", () => {
  const canvas = emptyCanvas("Ontario Watch");
  const ontario = item("news", "Officials debate renaming Lake Ontario");
  const sports = item("news", "Local team wins on Saturday");

  it("keeps web/news WatchBots on the natural-language relevance lane", () => {
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
    expect(RELEVANCE_THRESHOLD).toBe(0.12);
  });

  it("accepts a relevant web/news title against a relevant instruction on an empty Canvas", () => {
    const webOntario = item("web", ontario.title);
    expect(isRelevantEnough(scoreRelevance(ontario, NL_INSTRUCTION, canvas))).toBe(
      true,
    );
    expect(isRelevantEnough(scoreRelevance(webOntario, NL_INSTRUCTION, canvas))).toBe(
      true,
    );
  });

  describe("long focused Iran monitoring instructions", () => {
    const iranCanvas = emptyCanvas("Iran Monitor");

    it("accepts an Iranian government nuclear development", () => {
      const candidate = item(
        "news",
        "Iranian government signals new nuclear negotiations",
        "Officials described a new round of negotiations over Iran's nuclear program.",
      );
      expect(
        isRelevantEnough(
          scoreRelevance(candidate, IRAN_MONITOR_INSTRUCTION, iranCanvas),
        ),
      ).toBe(true);
    });

    it("uses a clearly relevant excerpt when the Iran title is sparse", () => {
      const candidate = item(
        "web",
        "Iran update",
        "Officials described new nuclear negotiations and sanctions discussions.",
      );
      expect(
        isRelevantEnough(
          scoreRelevance(candidate, IRAN_MONITOR_INSTRUCTION, iranCanvas),
        ),
      ).toBe(true);
    });

    it("accepts sanctions and security developments", () => {
      const candidate = item(
        "news",
        "New sanctions follow Iran security escalation",
        "European officials announced sanctions after the regional security development.",
      );
      expect(
        isRelevantEnough(
          scoreRelevance(candidate, IRAN_MONITOR_INSTRUCTION, iranCanvas),
        ),
      ).toBe(true);
    });

    it.each([
      ["travel", "Iran travel guide for first-time visitors", "Travel advice for a holiday itinerary."],
      ["entertainment", "Iran entertainment awards announced", "Entertainment coverage of this year's awards."],
      ["generic history", "A brief history of ancient Iran", "A generic history overview for students."],
    ])("rejects %s coverage", (_kind, title, snippet) => {
      expect(
        isRelevantEnough(
          scoreRelevance(item("web", title, snippet), IRAN_MONITOR_INSTRUCTION, iranCanvas),
        ),
      ).toBe(false);
    });

    it("does not dilute a relevant source when valid monitoring clauses are added", () => {
      const shortInstruction =
        "Follow meaningful developments about Iran. Focus on nuclear negotiations.";
      const candidate = item(
        "news",
        "Iran nuclear negotiations resume",
        "Diplomats resumed negotiations about Iran's nuclear program.",
      );
      expect(isRelevantEnough(scoreRelevance(candidate, shortInstruction, iranCanvas))).toBe(
        true,
      );
      expect(
        isRelevantEnough(
          scoreRelevance(candidate, IRAN_MONITOR_INSTRUCTION, iranCanvas),
        ),
      ).toBe(true);
    });
  });

  it("does not dilute a relevant news title after many unrelated Canvas Cards", () => {
    const populated = populatedUnrelatedCanvas();
    const diluted = concatenatedNaturalLanguageScore(
      ontario.title,
      NL_INSTRUCTION,
      populated,
    );
    expect(diluted).toBeLessThan(RELEVANCE_THRESHOLD);
    expect(isRelevantEnough(diluted)).toBe(false);

    const score = scoreRelevance(ontario, NL_INSTRUCTION, populated);
    expect(score).toBeGreaterThanOrEqual(RELEVANCE_THRESHOLD);
    expect(isRelevantEnough(score)).toBe(true);
    expect(RELEVANCE_THRESHOLD).toBe(0.12);
  });

  it("still rejects an irrelevant web/news title on a populated Canvas", () => {
    const populated = populatedUnrelatedCanvas();
    const newsScore = scoreRelevance(sports, NL_INSTRUCTION, populated);
    const webScore = scoreRelevance(
      item("web", sports.title),
      NL_INSTRUCTION,
      populated,
    );
    expect(isRelevantEnough(newsScore)).toBe(false);
    expect(isRelevantEnough(webScore)).toBe(false);
  });

  it("preserves multilingual / non-ASCII NL scoring via shared ASCII tokens", () => {
    const populated = populatedUnrelatedCanvas();
    const mixedTitle =
      "オンタリオ湖を Lake Ontario に改名する公式の議論が続いている";
    expect(tokenizeForScoring(mixedTitle)).toEqual(
      expect.arrayContaining(["lake", "ontario"]),
    );
    const emptyScore = scoreRelevance(
      item("news", mixedTitle),
      NL_INSTRUCTION,
      canvas,
    );
    const populatedScore = scoreRelevance(
      item("news", mixedTitle),
      NL_INSTRUCTION,
      populated,
    );
    expect(isRelevantEnough(emptyScore)).toBe(true);
    expect(isRelevantEnough(populatedScore)).toBe(true);
  });

  it("does not apply X operator stripping to a news candidate", () => {
    const newsOpenAI = item("news", "OpenAI shipped a new API");
    const xScore = scoreRelevance(item("x", newsOpenAI.title), X_QUERY, canvas);
    const newsScore = scoreRelevance(newsOpenAI, X_QUERY, canvas);
    expect(isRelevantEnough(xScore)).toBe(true);
    expect(newsScore).not.toBe(xScore);
  });
});
