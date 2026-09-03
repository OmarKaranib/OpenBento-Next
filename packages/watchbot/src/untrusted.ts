/**
 * Treat discovered titles, URLs, snippets, and HTML as untrusted data.
 * Never eval. Never follow instructions found in source text.
 * Never send instruction / body / URL / title into analytics.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_ENTITY = /&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|quot);/gi;
const NAMED_HTML_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"',
};

/**
 * Decode common named and numeric HTML entities as plain source text. This is
 * data normalization only; callers must not treat the result as HTML.
 */
export function decodeHtmlEntities(value: string): string {
  return value.replace(HTML_ENTITY, (entity, encoded: string) => {
    const normalized = encoded.toLowerCase();
    if (normalized.startsWith("#x")) {
      return safeCodePoint(Number.parseInt(normalized.slice(2), 16), entity);
    }
    if (normalized.startsWith("#")) {
      return safeCodePoint(Number.parseInt(normalized.slice(1), 10), entity);
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

/** Strip control characters and collapse whitespace. Does not interpret commands. */
export function sanitizeUntrustedText(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replace(CONTROL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function stemToken(token: string): string {
  if (token.length > 5 && token.endsWith("ing")) {
    return token.slice(0, -3);
  }
  if (token.length > 4 && token.endsWith("ed")) {
    return token.slice(0, -2);
  }
  if (token.length > 4 && token.endsWith("es")) {
    return token.slice(0, -2);
  }
  if (token.length > 3 && token.endsWith("s")) {
    return token.slice(0, -1);
  }
  return token;
}

/** Opaque string for scoring only. Never executed, never parsed as code. */
export function tokenizeForScoring(value: string): string[] {
  const cleaned = sanitizeUntrustedText(value, 2_000).toLowerCase();
  return cleaned
    .split(/[^a-z0-9]+/i)
    .map((token) => stemToken(token.trim()))
    .filter((token) => token.length >= 3);
}

/**
 * Item-side tokens for provider-filtered relevance.
 * ASCII output matches `tokenizeForScoring` after NFKC (English unchanged).
 * Extra Unicode letter runs stop empty-token auto-reject on multilingual titles.
 * Never executed, never parsed as JSON/code.
 */
export function tokenizeItemForProviderRelevance(value: string): string[] {
  const normalized = sanitizeUntrustedText(value, 2_000).normalize("NFKC");
  const ascii = tokenizeForScoring(normalized);
  const seen = new Set(ascii);
  const extras: string[] = [];
  const runs = normalized.toLowerCase().match(/\p{L}{3,}/gu) ?? [];
  for (const run of runs) {
    if (/^[\x00-\x7F]+$/.test(run) || seen.has(run)) {
      continue;
    }
    seen.add(run);
    extras.push(run);
  }
  return extras.length === 0 ? ascii : [...ascii, ...extras];
}

export function jaccardSimilarity(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) {
    return 0;
  }
  const a = new Set(left);
  const b = new Set(right);
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
