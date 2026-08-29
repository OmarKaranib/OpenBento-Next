import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_LIVE_YOUTUBE_EMBEDS,
  acquireYoutubeEmbedSlot,
  liveYoutubeEmbedIds,
  releaseYoutubeEmbedSlot,
  resetYoutubeEmbedSlots,
} from "./youtube-embed-slots";

afterEach(() => {
  resetYoutubeEmbedSlots();
});

describe("YouTube live embed cap", () => {
  it("does not keep unlimited live iframes mounted", () => {
    expect(MAX_LIVE_YOUTUBE_EMBEDS).toBe(2);
    acquireYoutubeEmbedSlot("a");
    acquireYoutubeEmbedSlot("b");
    acquireYoutubeEmbedSlot("c");
    expect([...liveYoutubeEmbedIds()]).toEqual(["b", "c"]);
    releaseYoutubeEmbedSlot("b");
    expect([...liveYoutubeEmbedIds()]).toEqual(["c"]);
  });
});
