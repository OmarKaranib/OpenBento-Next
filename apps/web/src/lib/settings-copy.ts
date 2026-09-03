/**
 * Product-facing Settings copy. No implementation / auth-internals jargon.
 */

import { sanitizeUntrustedDisplayText } from "@/lib/untrusted";

export const SIGNED_IN_SETTINGS_TITLE = "Your account";

export const SIGNED_IN_SETTINGS_BODY =
  "Canvas data is saved to your OpenBento account.";

export const SIGNED_IN_SETTINGS_NO_EMAIL = "Signed in to OpenBento.";

/**
 * Matches apps/web/package.json "version". Tests assert the two stay in sync.
 * Do not invent a separate marketing build id or secret.
 */
export const OPENBENTO_WEB_VERSION = "0.1.0";

export const SETTINGS_DEBUG_PHRASES = [
  "runDomainAction",
  "ownerId comes from",
  "auth.uid()",
  "ob_local_session",
  "getUser()",
  "RLS",
] as const;

export function openBentoVersionLabel(version = OPENBENTO_WEB_VERSION): string {
  return `OpenBento ${version}`;
}

/** Plain-text account line. Untrusted email is sanitized; missing → generic signed-in copy. */
export function signedInAccountLabel(email: unknown): string {
  const cleaned = sanitizeUntrustedDisplayText(email ?? "", 200);
  if (cleaned.length === 0) {
    return SIGNED_IN_SETTINGS_NO_EMAIL;
  }
  return `Signed in as ${cleaned}`;
}
