import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_LIVE_YOUTUBE_EMBEDS,
  acquireYoutubeEmbedSlot,
  liveYoutubeEmbedIds,
  releaseYoutubeEmbedSlot,
  resetYoutubeEmbedSlots,
  tryAcquireYoutubeEmbedSlot,
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

  it("auto-acquires only spare slots without evicting active players", () => {
    tryAcquireYoutubeEmbedSlot("first");
    tryAcquireYoutubeEmbedSlot("second");
    tryAcquireYoutubeEmbedSlot("third");

    expect([...liveYoutubeEmbedIds()]).toEqual(["first", "second"]);

    releaseYoutubeEmbedSlot("first");
    tryAcquireYoutubeEmbedSlot("third");
    expect([...liveYoutubeEmbedIds()]).toEqual(["second", "third"]);
  });

  it("allows an explicit click to promote a Card and evict the oldest slot", () => {
    tryAcquireYoutubeEmbedSlot("first");
    tryAcquireYoutubeEmbedSlot("second");
    acquireYoutubeEmbedSlot("third");

    expect([...liveYoutubeEmbedIds()]).toEqual(["second", "third"]);
  });
});
