/**
 * Guest / anonymous Auth helpers.
 * Identity always comes from Supabase Auth (auth.uid()). Never mint ownerId client-side.
 */

export type AuthUserLike = {
  id: string;
  is_anonymous?: boolean | null;
  email?: string | null;
};

export const GUEST_ENTRY_SUPPORT_COPY =
  "Start with a temporary workspace in this browser. Guest workspaces can be lost if you sign out, clear site data, or switch devices.";

export const GUEST_WORKSPACE_TITLE = "Temporary guest workspace";

export const GUEST_WORKSPACE_BODY =
  "Signing out, clearing site data, or switching devices may make this workspace inaccessible.";

export const GUEST_WORKSPACE_UPGRADE_NOTE =
  "Account upgrade is not available yet.";

export const GUEST_EXIT_BUTTON_LABEL = "Exit guest workspace";

export const GUEST_EXIT_CONFIRM_MESSAGE =
  "Leaving this guest session may permanently remove access to this workspace.";

export const GUEST_EXIT_KEEP_LABEL = "Keep workspace";

export const GUEST_EXIT_CONFIRM_LABEL = "Exit anyway";

export const ANONYMOUS_SIGNIN_DISABLED_MESSAGE =
  "Guest access is not available yet. Sign in with an existing account, or try again after anonymous sign-in is enabled.";

/** Copy that must not appear — implies guest data survives account signup/sign-in. */
export const GUEST_FALSE_RETENTION_PHRASES = [
  "Create an account later to keep access across devices",
  "Sign in or create an account to keep access across devices",
  "keep access across devices",
] as const;

/** Phrases that must not appear for guests (false permanence). */
export const GUEST_FALSE_PERMANENCE_PHRASES = [
  "synced permanently across all devices",
  "your guest account is permanent",
  ...GUEST_FALSE_RETENTION_PHRASES,
] as const;

// TODO(guest-upgrade): anonymous → permanent must preserve the same Supabase user
// identity (linkIdentity / updateUser) or explicitly migrate ownership — not a new
// signInWithPassword session with a different auth.uid().

export function isAnonymousUser(user: AuthUserLike | null | undefined): boolean {
  if (!user) {
    return false;
  }
  if (user.is_anonymous === true) {
    return true;
  }
  // Permanent email/password users always carry an email after signup/signin.
  if (user.is_anonymous === false) {
    return false;
  }
  return false;
}

export function guestSignInErrorMessage(error: unknown): string {
  if (!error) {
    return ANONYMOUS_SIGNIN_DISABLED_MESSAGE;
  }
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" &&
            error !== null &&
            "message" in error &&
            typeof (error as { message: unknown }).message === "string"
          ? (error as { message: string }).message
          : "";
  const lower = message.toLowerCase();
  if (
    lower.includes("anonymous") ||
    lower.includes("signups not allowed") ||
    lower.includes("not enabled") ||
    lower.includes("unsupported") ||
    lower.includes("403") ||
    lower.includes("disabled")
  ) {
    return ANONYMOUS_SIGNIN_DISABLED_MESSAGE;
  }
  if (message.trim().length > 0) {
    return message;
  }
  return ANONYMOUS_SIGNIN_DISABLED_MESSAGE;
}

export type AnonymousSignInClient = {
  auth: {
    signInAnonymously: () => Promise<{
      data: { user: AuthUserLike | null; session: unknown };
      error: { message: string } | null;
    }>;
  };
};

/**
 * Try OpenBento via Supabase anonymous Auth.
 * Fail-closed: never fabricates ownerId or falls back to unsigned cookies.
 */
export async function tryOpenBentoAnonymously(
  client: AnonymousSignInClient,
): Promise<{ user: AuthUserLike }> {
  const { data, error } = await client.auth.signInAnonymously();
  if (error) {
    throw new Error(guestSignInErrorMessage(error));
  }
  if (!data.user?.id) {
    throw new Error(ANONYMOUS_SIGNIN_DISABLED_MESSAGE);
  }
  return { user: data.user };
}
