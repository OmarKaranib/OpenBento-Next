import { safeHttpUrl } from "./untrusted";

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

/**
 * Extract an official YouTube video id from a supported public URL.
 * Does not fetch, scrape, or call YouTube APIs.
 */
export function parseYouTubeVideoId(value: unknown): string | null {
  const href = safeHttpUrl(value);
  if (!href) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())) {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    return YOUTUBE_ID.test(id) ? id : null;
  }
  const fromQuery = parsed.searchParams.get("v");
  if (fromQuery && YOUTUBE_ID.test(fromQuery)) {
    return fromQuery;
  }
  const parts = parsed.pathname.split("/").filter(Boolean);
  const prefixed = ["embed", "shorts", "live", "v"];
  if (parts.length >= 2 && prefixed.includes(parts[0] ?? "")) {
    const id = parts[1] ?? "";
    return YOUTUBE_ID.test(id) ? id : null;
  }
  return null;
}

/** Canonical watch URL. Used as stored provenance.sourceUrl, never as iframe src. */
export function canonicalYouTubeWatchUrl(videoId: string): string {
  if (!YOUTUBE_ID.test(videoId)) {
    throw new Error("Invalid YouTube video id");
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Official YouTube embed URL constructed from a validated id.
 * Never pass a user-supplied URL through as iframe src.
 */
export function officialYouTubeEmbedUrl(videoId: string): string {
  if (!YOUTUBE_ID.test(videoId)) {
    throw new Error("Invalid YouTube video id");
  }
  return `https://www.youtube.com/embed/${videoId}`;
}

export function isYouTubeVideoId(value: unknown): value is string {
  return typeof value === "string" && YOUTUBE_ID.test(value);
}
