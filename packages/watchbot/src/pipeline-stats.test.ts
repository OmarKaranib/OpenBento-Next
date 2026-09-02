import { describe, expect, it } from "vitest";
import { computePipelineCycleStats, type PipelineItemResult } from "./pipeline";

describe("computePipelineCycleStats novel counting", () => {
  it("counts rejected relevance as novel", () => {
    const items: PipelineItemResult[] = [
      {
        kind: "rejected_relevance",
        dedupKey: "a",
        passedNovelty: true,
      },
    ];
    expect(computePipelineCycleStats(1, items, 0).novel).toBe(1);
  });

  it("counts card_created as novel", () => {
    const items: PipelineItemResult[] = [
      {
        kind: "card_created",
        dedupKey: "a",
        cardId: "card-1",
        passedNovelty: true,
      },
    ];
    expect(computePipelineCycleStats(1, items, 1).novel).toBe(1);
  });

  it("does not count low_novelty as novel", () => {
    const items: PipelineItemResult[] = [
      {
        kind: "normalized",
        dedupKey: "a",
        noveltyScore: 0.1,
        detail: "low_novelty",
      },
    ];
    expect(computePipelineCycleStats(1, items, 0).novel).toBe(0);
  });

  it("does not count duplicate as novel", () => {
    const items: PipelineItemResult[] = [
      { kind: "duplicate", dedupKey: "a" },
    ];
    expect(computePipelineCycleStats(1, items, 0).novel).toBe(0);
  });

  it("counts post-novelty errors as novel", () => {
    const items: PipelineItemResult[] = [
      {
        kind: "error",
        dedupKey: "a",
        detail: "source_payload_invalid",
        passedNovelty: true,
      },
      {
        kind: "error",
        dedupKey: "b",
        detail: "create_failed",
        passedNovelty: true,
      },
    ];
    expect(computePipelineCycleStats(2, items, 0).novel).toBe(2);
    expect(computePipelineCycleStats(2, items, 0).errors).toBe(2);
  });

  it("does not count pre-novelty normalize errors as novel", () => {
    const items: PipelineItemResult[] = [
      {
        kind: "error",
        dedupKey: "a",
        detail: "not_v0_source_or_unusable",
      },
    ];
    const stats = computePipelineCycleStats(1, items, 0);
    expect(stats.novel).toBe(0);
    expect(stats.normalized).toBe(0);
    expect(stats.candidatesEligible).toBe(0);
    expect(stats.clustered).toBe(0);
    expect(stats.representatives).toBe(0);
    expect(stats.selected).toBe(0);
  });

  it("counts eligible vs selected without treating rejects as candidates", () => {
    const items: PipelineItemResult[] = [
      {
        kind: "card_created",
        dedupKey: "kept",
        cardId: "card-1",
        passedNovelty: true,
        candidateEligible: true,
        selected: true,
      },
      {
        kind: "normalized",
        dedupKey: "skipped",
        detail: "not_selected",
        passedNovelty: true,
        candidateEligible: true,
      },
      { kind: "duplicate", dedupKey: "dup" },
      {
        kind: "rejected_relevance",
        dedupKey: "noise",
        passedNovelty: true,
      },
    ];
    const stats = computePipelineCycleStats(4, items, 1);
    expect(stats.candidatesEligible).toBe(2);
    expect(stats.clustered).toBe(0);
    expect(stats.representatives).toBe(2);
    expect(stats.meaningful).toBe(2);
    expect(stats.notMeaningful).toBe(0);
    expect(stats.selected).toBe(1);
    expect(stats.cardsCreated).toBe(1);
    expect(stats.duplicates).toBe(1);
    expect(stats.rejectedRelevance).toBe(1);
  });

  it("counts clustered members separately from representatives", () => {
    const items: PipelineItemResult[] = [
      {
        kind: "card_created",
        dedupKey: "kept",
        cardId: "card-1",
        passedNovelty: true,
        candidateEligible: true,
        selected: true,
      },
      {
        kind: "normalized",
        dedupKey: "paraphrase",
        detail: "clustered",
        passedNovelty: true,
        candidateEligible: true,
        clustered: true,
      },
      {
        kind: "normalized",
        dedupKey: "skipped-rep",
        detail: "not_selected",
        passedNovelty: true,
        candidateEligible: true,
      },
    ];
    const stats = computePipelineCycleStats(3, items, 1);
    expect(stats.candidatesEligible).toBe(3);
    expect(stats.clustered).toBe(1);
    expect(stats.representatives).toBe(2);
    expect(stats.meaningful).toBe(2);
    expect(stats.notMeaningful).toBe(0);
    expect(stats.selected).toBe(1);
  });

  it("counts not-meaningful representatives separately from cap skips", () => {
    const items: PipelineItemResult[] = [
      {
        kind: "card_created",
        dedupKey: "kept",
        cardId: "card-1",
        passedNovelty: true,
        candidateEligible: true,
        selected: true,
        importanceScore: 0.9,
      },
      {
        kind: "normalized",
        dedupKey: "chatter",
        detail: "not_meaningful",
        passedNovelty: true,
        candidateEligible: true,
        notMeaningful: true,
        importanceScore: 0.1,
      },
      {
        kind: "normalized",
        dedupKey: "paraphrase",
        detail: "clustered",
        passedNovelty: true,
        candidateEligible: true,
        clustered: true,
      },
    ];
    const stats = computePipelineCycleStats(3, items, 1);
    expect(stats.candidatesEligible).toBe(3);
    expect(stats.clustered).toBe(1);
    expect(stats.representatives).toBe(2);
    expect(stats.meaningful).toBe(1);
    expect(stats.notMeaningful).toBe(1);
    expect(stats.selected).toBe(1);
  });
});
