import { describe, expect, it } from "vitest";
import { deriveProviderSearchQuery } from "./provider-query";

describe("deriveProviderSearchQuery", () => {
  it("removes monitoring and notification language without changing semantic truth", () => {
    expect(
      deriveProviderSearchQuery(
        "Follow important breaking news about Iran and alert me when something meaningful happens",
        "x",
        512,
      ),
    ).toBe("breaking news Iran");
    expect(
      deriveProviderSearchQuery("follow important news on Iran", "x", 512),
    ).toBe("news Iran");
  });

  it("produces provider-focused queries while preserving useful terms", () => {
    expect(
      deriveProviderSearchQuery("watch OpenAI announcements", "x", 512),
    ).toBe("OpenAI announcements");
    expect(
      deriveProviderSearchQuery(
        "latest videos about Iran nuclear talks",
        "youtube",
        400,
      ),
    ).toBe("Iran nuclear talks");
  });

  it("preserves handles, hashtags, quoted phrases, and concise queries", () => {
    expect(
      deriveProviderSearchQuery("monitor @OpenAI for GPT-6", "x", 512),
    ).toBe("@OpenAI GPT-6");
    expect(
      deriveProviderSearchQuery('follow #AI "Sam Altman" updates', "x", 512),
    ).toBe('#AI "Sam Altman" updates');
    expect(deriveProviderSearchQuery("SpaceX Starship", "x", 512)).toBe(
      "SpaceX Starship",
    );
  });

  it("preserves multilingual topic text", () => {
    expect(
      deriveProviderSearchQuery("إيران مذاکرات هسته‌ای", "youtube", 400),
    ).toBe("إيران مذاکرات هسته‌ای");
  });

  it("fails closed for empty or meta-only input", () => {
    expect(deriveProviderSearchQuery("\u0000 \n", "x", 512)).toBe("");
    expect(deriveProviderSearchQuery("monitor", "x", 512)).toBe("");
  });

  it("enforces the caller's provider length ceiling", () => {
    const query = deriveProviderSearchQuery(`monitor ${"Iran ".repeat(200)}`, "x", 64);
    expect(query.length).toBeLessThanOrEqual(64);
  });
});
