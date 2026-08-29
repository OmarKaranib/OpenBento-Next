import type {
  CardType,
  CreateCardInput,
  Point,
  Size,
  SourceType,
} from "@openbento/domain";
import { isValidCardPayload } from "@openbento/domain";
import { hostnameFromHttpUrl, safeHttpUrl, sanitizeUntrustedDisplayText } from "../untrusted";
import {
  canonicalYouTubeWatchUrl,
  parseYouTubeVideoId,
} from "../youtube";

export const YOUTUBE_DEFAULT_SIZE: Size = { width: 320, height: 228 };
export const SOURCE_LINK_DEFAULT_SIZE: Size = { width: 280, height: 180 };

export type CreatableSourceCardType = Extract<CardType, "youtube" | "article" | "web">;

function publishedNow(value?: string): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return new Date().toISOString();
}

function titleForSource(title: string | undefined, fallbackUrl: string): string {
  const cleaned = sanitizeUntrustedDisplayText(title ?? "", 300);
  if (cleaned.length > 0) {
    return cleaned;
  }
  return hostnameFromHttpUrl(fallbackUrl);
}

/**
 * UI path for YouTube Cards.
 * Emits discriminated `{ type: "youtube", payload: SourceCardPayload }`.
 * Provenance is required. Official YouTube URLs only — no scrape, no extra APIs.
 */
export function buildCreateYoutubeCardInput(args: {
  canvasId: string;
  sourceUrl: string;
  title?: string;
  publishedAt?: string;
  position?: Point;
  size?: Size;
}): CreateCardInput {
  const videoId = parseYouTubeVideoId(args.sourceUrl);
  if (!videoId) {
    throw new Error("YouTube Cards require an official YouTube watch/embed URL");
  }
  const sourceUrl = canonicalYouTubeWatchUrl(videoId);
  const payload = {
    provenance: {
      sourceUrl,
      title: titleForSource(args.title, sourceUrl),
      publishedAt: publishedNow(args.publishedAt),
      sourceType: "youtube" as const,
      externalId: videoId,
    },
  };
  if (!isValidCardPayload("youtube", payload)) {
    throw new Error("YouTube payload failed PAYLOAD_SCHEMAS.youtube");
  }
  return {
    canvasId: args.canvasId,
    type: "youtube",
    payload,
    ...(args.position ? { position: args.position } : {}),
    size: args.size ?? YOUTUBE_DEFAULT_SIZE,
  };
}

function buildLinkSourceCardInput(
  type: "article" | "web",
  sourceType: SourceType,
  args: {
    canvasId: string;
    sourceUrl: string;
    title?: string;
    publishedAt?: string;
    position?: Point;
    size?: Size;
    author?: string;
  },
): CreateCardInput {
  const sourceUrl = safeHttpUrl(args.sourceUrl);
  if (!sourceUrl) {
    throw new Error("Source Cards require an http(s) URL");
  }
  const payload = {
    provenance: {
      sourceUrl,
      title: titleForSource(args.title, sourceUrl),
      publishedAt: publishedNow(args.publishedAt),
      sourceType,
      ...(args.author
        ? { author: sanitizeUntrustedDisplayText(args.author, 200) }
        : {}),
    },
  };
  if (!isValidCardPayload(type, payload)) {
    throw new Error(`${type} payload failed PAYLOAD_SCHEMAS.${type}`);
  }
  return {
    canvasId: args.canvasId,
    type,
    payload,
    ...(args.position ? { position: args.position } : {}),
    size: args.size ?? SOURCE_LINK_DEFAULT_SIZE,
  };
}

/**
 * UI path for Article Cards.
 * Emits `{ type: "article", payload: SourceCardPayload }` with required provenance.
 */
export function buildCreateArticleCardInput(args: {
  canvasId: string;
  sourceUrl: string;
  title?: string;
  publishedAt?: string;
  position?: Point;
  size?: Size;
  author?: string;
}): CreateCardInput {
  return buildLinkSourceCardInput("article", "web", args);
}

/**
 * UI path for Web Cards (catalog type `web`).
 * Same SourceCardPayload contract as article; type stays `web`.
 */
export function buildCreateWebCardInput(args: {
  canvasId: string;
  sourceUrl: string;
  title?: string;
  publishedAt?: string;
  position?: Point;
  size?: Size;
  author?: string;
}): CreateCardInput {
  return buildLinkSourceCardInput("web", "web", args);
}

export function buildCreateSourceCardInput(args: {
  canvasId: string;
  type: CreatableSourceCardType;
  sourceUrl: string;
  title?: string;
  publishedAt?: string;
  position?: Point;
  size?: Size;
}): CreateCardInput {
  if (args.type === "youtube") {
    return buildCreateYoutubeCardInput(args);
  }
  if (args.type === "article") {
    return buildCreateArticleCardInput(args);
  }
  return buildCreateWebCardInput(args);
}
