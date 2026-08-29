/**
 * Display-time handling for untrusted source titles, URLs, and snippets.
 * Never eval. Never inject as HTML/JS. Never use innerHTML / srcDoc.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

/** Strip tags/controls and collapse whitespace. Result is plain text only. */
export function sanitizeUntrustedDisplayText(
  value: unknown,
  maxLength = 500,
): string {
  if (typeof value !== "string") {
    return "";
  }
  return value
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
