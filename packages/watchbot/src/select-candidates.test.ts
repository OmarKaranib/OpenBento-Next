import { describe, expect, it } from "vitest";
import {
  MAX_SELECTED_PER_CYCLE,
  compareCandidates,
  selectCandidates,
  type RankableCandidate,
} from "./select-candidates";

function candidate(
  arrivalIndex: number,
  relevanceScore: number,
  noveltyScore = 1,
): RankableCandidate {
  return { arrivalIndex, relevanceScore, noveltyScore };
}

describe("selectCandidates", () => {
  it("lets a later stronger candidate outrank an earlier weaker one", () => {
    const earlierWeaker = candidate(0, 0.2, 1);
    const laterStronger = candidate(1, 0.9, 1);
    expect(selectCandidates([earlierWeaker, laterStronger])).toEqual([
      laterStronger,
      earlierWeaker,
    ]);
    expect(compareCandidates(laterStronger, earlierWeaker)).toBeLessThan(0);
  });

  it("breaks exact ties deterministically by earlier arrival", () => {
    const first = candidate(0, 0.5, 0.8);
    const second = candidate(1, 0.5, 0.8);
    const third = candidate(2, 0.5, 0.8);
    expect(selectCandidates([third, first, second])).toEqual([
      first,
      second,
      third,
    ]);
    expect(selectCandidates([third, first, second])).toEqual(
      selectCandidates([second, third, first]),
    );
  });

  it("caps selection per cycle", () => {
    const pool = [
      candidate(0, 0.2),
      candidate(1, 0.9),
      candidate(2, 0.4),
      candidate(3, 0.7),
      candidate(4, 0.3),
      candidate(5, 0.8),
      candidate(6, 0.1),
    ];
    const selected = selectCandidates(pool);
    expect(MAX_SELECTED_PER_CYCLE).toBe(5);
    expect(selected).toHaveLength(5);
    expect(selected.map((item) => item.arrivalIndex)).toEqual([1, 5, 3, 2, 4]);
    expect(selected.some((item) => item.arrivalIndex === 0)).toBe(false);
    expect(selected.some((item) => item.arrivalIndex === 6)).toBe(false);
  });

  it("honors an explicit smaller cap", () => {
    const selected = selectCandidates(
      [candidate(0, 0.2), candidate(1, 0.9), candidate(2, 0.4)],
      1,
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]?.arrivalIndex).toBe(1);
  });

  it("does not penalize non-ASCII titles; scores alone decide rank", () => {
    const earlierAsciiWeaker = {
      arrivalIndex: 0,
      relevanceScore: 0.25,
      noveltyScore: 1,
      title: "Ontario lake news brief",
    };
    const laterMultilingualStronger = {
      arrivalIndex: 1,
      relevanceScore: 0.8,
      noveltyScore: 1,
      title: "オンタリオ湖をレイク・アメリカに改名する公式発表",
    };
    const arabicAlsoStrong = {
      arrivalIndex: 2,
      relevanceScore: 0.8,
      noveltyScore: 1,
      title: "إعلان رسمي لإعادة تسمية بحيرة أونتاريو",
    };

    const selected = selectCandidates([
      earlierAsciiWeaker,
      laterMultilingualStronger,
      arabicAlsoStrong,
    ]);

    expect(selected[0]).toBe(laterMultilingualStronger);
    expect(selected.map((item) => item.title)).toEqual([
      laterMultilingualStronger.title,
      arabicAlsoStrong.title,
      earlierAsciiWeaker.title,
    ]);
    expect(compareCandidates(laterMultilingualStronger, arabicAlsoStrong)).toBe(
      compareCandidates(
        { arrivalIndex: 1, relevanceScore: 0.8, noveltyScore: 1 },
        { arrivalIndex: 2, relevanceScore: 0.8, noveltyScore: 1 },
      ),
    );
  });

  it("does not mutate the input list", () => {
    const pool = [candidate(0, 0.2), candidate(1, 0.9)];
    const snapshot = [...pool];
    selectCandidates(pool);
    expect(pool).toEqual(snapshot);
  });

  it("returns an empty list for an empty pool or a zero cap", () => {
    expect(selectCandidates([])).toEqual([]);
    expect(selectCandidates([candidate(0, 1)], 0)).toEqual([]);
  });
});
