/**
 * Display-time handling for untrusted source titles, URLs, and snippets.
 * Never eval. Never inject as HTML/JS. Never use innerHTML / srcDoc.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const HTML_ENTITY = /&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|quot);/gi;
const NAMED_HTML_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"',
};

/**
 * Decode a deliberately small HTML-entity subset into text before display
 * sanitization. This never creates an HTML sink: callers still render React
 * text and strip decoded markup below.
 */
export function decodeHtmlEntities(value: string): string {
  return value.replace(HTML_ENTITY, (entity, encoded: string) => {
    const normalized = encoded.toLowerCase();
    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return safeCodePoint(codePoint, entity);
    }
    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return safeCodePoint(codePoint, entity);
    }
    return NAMED_HTML_ENTITIES[normalized] ?? entity;
  });
}

function safeCodePoint(codePoint: number, fallback: string): string {
  if (
    !Number.isInteger(codePoint) ||
    codePoint < 0 ||
    codePoint > 0x10ffff ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
  ) {
    return fallback;
  }
  return String.fromCodePoint(codePoint);
}

/** Strip tags/controls and collapse whitespace. Result is plain text only. */
export function sanitizeUntrustedDisplayText(
  value: unknown,
  maxLength = 500,
): string {
  if (typeof value !== "string") {
    return "";
  }
  return decodeHtmlEntities(value)
    .replace(CONTROL_CHARS, "")
    .replace(HTML_COMMENT, "")
    .replace(HTML_TAG, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/**
 * Allow only http(s) URLs for source links. Rejects javascript:, data:,
 * and other non-http schemes. Returns a normalized href or null.
 */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  if (parsed.username || parsed.password) {
    return null;
  }
  return parsed.href;
}

/** Defense-in-depth for X-owned image/video URLs persisted by the worker. */
export function safeXMediaUrl(
  value: unknown,
  kind: "image" | "video",
): string | null {
  const href = safeHttpUrl(value);
  if (!href) {
    return null;
  }
  try {
    const url = new URL(href);
    const expectedHost = kind === "video" ? "video.twimg.com" : "pbs.twimg.com";
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== expectedHost ||
      url.port ||
      (kind === "video" && !url.pathname.toLowerCase().endsWith(".mp4"))
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function hostnameFromHttpUrl(value: unknown): string {
  const href = safeHttpUrl(value);
  if (!href) {
    return "";
  }
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
