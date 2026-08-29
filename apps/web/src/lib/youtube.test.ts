import { describe, expect, it } from "vitest";
import {
  canonicalYouTubeWatchUrl,
  officialYouTubeEmbedUrl,
  parseYouTubeVideoId,
} from "./youtube";

const VIDEO_ID = "dQw4w9WgXcQ";

describe("official YouTube URL parsing", () => {
  it("accepts official watch, share, embed, shorts, and live URLs", () => {
    expect(
      parseYouTubeVideoId(`https://www.youtube.com/watch?v=${VIDEO_ID}`),
    ).toBe(VIDEO_ID);
    expect(parseYouTubeVideoId(`https://youtu.be/${VIDEO_ID}`)).toBe(VIDEO_ID);
    expect(
      parseYouTubeVideoId(`https://www.youtube.com/embed/${VIDEO_ID}`),
    ).toBe(VIDEO_ID);
    expect(
      parseYouTubeVideoId(`https://www.youtube.com/shorts/${VIDEO_ID}`),
    ).toBe(VIDEO_ID);
    expect(
      parseYouTubeVideoId(`https://www.youtube.com/live/${VIDEO_ID}`),
    ).toBe(VIDEO_ID);
  });

  it("rejects non-YouTube hosts and non-http schemes", () => {
    expect(
      parseYouTubeVideoId(`https://evil.example/watch?v=${VIDEO_ID}`),
    ).toBeNull();
    expect(parseYouTubeVideoId(`javascript:${VIDEO_ID}`)).toBeNull();
    expect(
      parseYouTubeVideoId(`https://youtube.com.evil.example/watch?v=${VIDEO_ID}`),
    ).toBeNull();
  });

  it("builds the official embed URL from a validated id only", () => {
    expect(officialYouTubeEmbedUrl(VIDEO_ID)).toBe(
      `https://www.youtube.com/embed/${VIDEO_ID}`,
    );
    expect(canonicalYouTubeWatchUrl(VIDEO_ID)).toBe(
      `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    );
    expect(() => officialYouTubeEmbedUrl("<script>")).toThrow(/Invalid YouTube/);
  });
});
