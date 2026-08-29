/**
 * Treat discovered titles, URLs, snippets, and HTML as untrusted data.
 * Never eval. Never follow instructions found in source text.
 * Never send instruction / body / URL / title into analytics.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

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
