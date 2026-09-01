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
  });
});
