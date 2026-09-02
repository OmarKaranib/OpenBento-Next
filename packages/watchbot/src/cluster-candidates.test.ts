import { describe, expect, it } from "vitest";
import {
  SAME_STORY_JACCARD,
  areSameStory,
  clusterCandidates,
  tokenizeForClustering,
} from "./cluster-candidates";
import { compareCandidates, type RankableCandidate } from "./select-candidates";

interface TitledCandidate extends RankableCandidate {
  title: string;
  url?: string;
}

function candidate(
  arrivalIndex: number,
  title: string,
  relevanceScore: number,
  noveltyScore = 1,
  url?: string,
): TitledCandidate {
  return { arrivalIndex, title, relevanceScore, noveltyScore, url };
}

const titleOf = (item: TitledCandidate) => item.title;

describe("tokenizeForClustering", () => {
  it("is Unicode-aware and does not use English stemming", () => {
    expect(tokenizeForClustering("Officials debate renaming Lake Ontario")).toEqual(
      ["officials", "debate", "renaming", "lake", "ontario"],
    );
    expect(tokenizeForClustering("Renaming")).toEqual(["renaming"]);
    expect(tokenizeForClustering("Rename")).toEqual(["rename"]);
  });

  it("retains non-ASCII letters instead of dropping them", () => {
    const japanese = tokenizeForClustering(
      "オンタリオ湖をレイクアメリカに改名する公式発表",
    );
    expect(japanese.length).toBeGreaterThan(0);
    expect(japanese.every((token) => /^[\x00-\x7F]+$/.test(token))).toBe(false);

    const arabic = tokenizeForClustering("إعلان رسمي لإعادة تسمية بحيرة أونتاريو");
    expect(arabic.length).toBeGreaterThan(0);
    expect(arabic.some((token) => /[^\x00-\x7F]/.test(token))).toBe(true);
  });

  it("does not automatically penalize or empty a multilingual title", () => {
    const mixed = tokenizeForClustering("OpenAIとWebMCPの公式発表");
    expect(mixed).toEqual(
      expect.arrayContaining(["openai", "webmcp"]),
    );
    expect(mixed.some((token) => /[^\x00-\x7F]/.test(token))).toBe(true);
  });
});

describe("areSameStory", () => {
  it("collapses obvious paraphrases of one development", () => {
    const canonical =
      "Officials debate renaming Lake Ontario to Lake America";
    expect(
      areSameStory(canonical, "Officials debate renaming Lake Ontario to Lake America today"),
    ).toBe(true);
    expect(
      areSameStory(canonical, "Officials debate renaming Lake Ontario to Lake America update"),
    ).toBe(true);
    expect(
      areSameStory(
        "Officials debate renaming Lake Ontario",
        "Officials debate renaming Lake Ontario again",
      ),
    ).toBe(true);
    expect(areSameStory(canonical, canonical)).toBe(true);
  });

  it("keeps materially different developments separate", () => {
    const debate =
      "Officials debate renaming Lake Ontario to Lake America";
    expect(
      areSameStory(debate, "Canada files a lawsuit over the Lake Ontario rename"),
    ).toBe(false);
    expect(
      areSameStory(debate, "Officials approve renaming Lake Ontario to Lake America"),
    ).toBe(false);
    expect(
      areSameStory(
        "OpenAI shipped a new API",
        "OpenAI acquired a research startup",
      ),
    ).toBe(false);
  });

  it("clusters non-ASCII paraphrases and does not drop them", () => {
    expect(
      areSameStory(
        "オンタリオ湖をレイクアメリカに改名する公式発表",
        "オンタリオ湖をレイクアメリカに改名する公式の発表",
      ),
    ).toBe(true);
    expect(
      areSameStory(
        "إعلان رسمي لإعادة تسمية بحيرة أونتاريو",
        "إعلان رسمي لإعادة تسمية بحيرة أونتاريو اليوم",
      ),
    ).toBe(true);
    expect(
      areSameStory(
        "オンタリオ湖をレイクアメリカに改名する公式発表",
        "Canada files a lawsuit over the Lake Ontario rename",
      ),
    ).toBe(false);
  });

  it("never treats empty tokenization as a match", () => {
    expect(areSameStory("", "Officials debate renaming Lake Ontario")).toBe(
      false,
    );
    expect(areSameStory("!!!", "???")).toBe(false);
  });
});

describe("clusterCandidates", () => {
  it("collapses paraphrases to one representative", () => {
    const weaker = candidate(
      0,
      "Officials debate renaming Lake Ontario to Lake America",
      0.4,
    );
    const stronger = candidate(
      1,
      "Officials debate renaming Lake Ontario to Lake America today",
      0.9,
    );
    const also = candidate(
      2,
      "Officials debate renaming Lake Ontario to Lake America update",
      0.5,
    );
    const result = clusterCandidates([weaker, stronger, also], titleOf);
    expect(result.clusters).toHaveLength(1);
    expect(result.representatives).toEqual([stronger]);
    expect(result.clusteredCount).toBe(2);
    expect(result.clusters[0]?.members).toEqual([weaker, stronger, also]);
  });

  it("does not cluster materially different developments", () => {
    const debate = candidate(
      0,
      "Officials debate renaming Lake Ontario to Lake America",
      0.8,
    );
    const lawsuit = candidate(
      1,
      "Canada files a lawsuit over the Lake Ontario rename",
      0.7,
    );
    const hearings = candidate(
      2,
      "New York lawmakers schedule Lake America hearings",
      0.6,
    );
    const result = clusterCandidates([debate, lawsuit, hearings], titleOf);
    expect(result.representatives).toEqual([debate, lawsuit, hearings]);
    expect(result.clusteredCount).toBe(0);
    expect(SAME_STORY_JACCARD).toBe(0.72);
  });

  it("picks the representative with relevance → novelty → arrivalIndex", () => {
    const earlierWeaker = candidate(0, "Officials debate renaming Lake Ontario", 0.2);
    const laterStronger = candidate(
      1,
      "Officials debate renaming Lake Ontario again",
      0.9,
    );
    const noveltyWins = candidate(
      0,
      "Officials debate renaming Lake Ontario",
      0.5,
      0.4,
    );
    const higherNovelty = candidate(
      1,
      "Officials debate renaming Lake Ontario again",
      0.5,
      0.9,
    );
    const first = candidate(0, "Officials debate renaming Lake Ontario", 0.5, 0.8);
    const second = candidate(
      1,
      "Officials debate renaming Lake Ontario",
      0.5,
      0.8,
    );

    expect(
      clusterCandidates([earlierWeaker, laterStronger], titleOf).representatives,
    ).toEqual([laterStronger]);
    expect(
      clusterCandidates([noveltyWins, higherNovelty], titleOf).representatives,
    ).toEqual([higherNovelty]);
    expect(clusterCandidates([second, first], titleOf).representatives).toEqual([
      first,
    ]);
    expect(compareCandidates(laterStronger, earlierWeaker)).toBeLessThan(0);
  });

  it("is deterministic regardless of input order within a cluster", () => {
    const first = candidate(0, "Officials debate renaming Lake Ontario", 0.5);
    const second = candidate(1, "Officials debate renaming Lake Ontario", 0.5);
    const third = candidate(2, "Officials debate renaming Lake Ontario", 0.5);
    expect(clusterCandidates([third, first, second], titleOf).representatives).toEqual(
      clusterCandidates([second, third, first], titleOf).representatives,
    );
    expect(clusterCandidates([third, first, second], titleOf).representatives[0]).toBe(
      first,
    );
  });

  it("keeps the representative object identity and metadata unchanged", () => {
    const keeper = candidate(
      1,
      "Officials debate renaming Lake Ontario to Lake America",
      0.9,
      1,
      "https://news.example.com/keeper",
    );
    const other = candidate(
      0,
      "Officials debate renaming Lake Ontario to Lake America today",
      0.4,
      1,
      "https://news.example.com/other",
    );
    const result = clusterCandidates([other, keeper], titleOf);
    expect(result.representatives[0]).toBe(keeper);
    expect(result.representatives[0]?.url).toBe(
      "https://news.example.com/keeper",
    );
    expect(result.representatives[0]?.title).toBe(keeper.title);
  });

  it("does not mutate the input list", () => {
    const pool = [
      candidate(0, "Officials debate renaming Lake Ontario", 0.5),
      candidate(1, "Canada files a lawsuit over the Lake Ontario rename", 0.5),
    ];
    const snapshot = [...pool];
    clusterCandidates(pool, titleOf);
    expect(pool).toEqual(snapshot);
  });

  it("returns an empty result for an empty pool", () => {
    expect(clusterCandidates([], titleOf)).toEqual({
      representatives: [],
      clusters: [],
      clusteredCount: 0,
    });
  });
});
