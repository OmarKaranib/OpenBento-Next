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
  "Start with a temporary workspace. Create an account later to keep access across devices.";

export const GUEST_WORKSPACE_TITLE = "Guest workspace";

export const GUEST_WORKSPACE_BODY =
  "This workspace is tied to this browser. Sign in or create an account to keep access across devices.";

export const ANONYMOUS_SIGNIN_DISABLED_MESSAGE =
  "Guest access is not available yet. Sign in with an existing account, or try again after anonymous sign-in is enabled.";

/** Phrases that must not appear for guests (false permanence). */
export const GUEST_FALSE_PERMANENCE_PHRASES = [
  "synced permanently across all devices",
  "your guest account is permanent",
] as const;

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
