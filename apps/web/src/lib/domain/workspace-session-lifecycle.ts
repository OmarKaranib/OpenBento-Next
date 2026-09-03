/**
 * Bind browser WorkspaceSession instances to a verified Auth principal.
 *
 * A module-global session must not survive an in-tab principal change
 * (user A → user B, guest → permanent, sign-out). Identity is always the
 * Supabase Auth user id — never a client-supplied ownerId.
 */

import type { AuthUserLike } from "@/lib/auth/guest";
import {
  WorkspaceSession,
  type WorkspaceSessionOptions,
} from "@/lib/domain/workspace-session";

/** Verified principal key: auth.uid(), or null when signed out. */
export function principalIdFromAuthUser(
  user: AuthUserLike | null | undefined,
): string | null {
  const id = user?.id?.trim();
  return id && id.length > 0 ? id : null;
}

export function shouldReplaceWorkspaceSession(
  boundPrincipalId: string | null,
  nextPrincipalId: string | null,
): boolean {
  return boundPrincipalId !== nextPrincipalId;
}

export type WorkspaceSessionFactory = () => WorkspaceSession;

/**
 * Owns at most one live WorkspaceSession, keyed by verified principal id.
 * Call {@link bind} when signed in; {@link retire} on sign-out.
 */
export class WorkspaceSessionBinder {
  private session: WorkspaceSession | undefined;
  private boundPrincipalId: string | null = null;
  private readonly create: WorkspaceSessionFactory;

  constructor(create: WorkspaceSessionFactory) {
    this.create = create;
  }

  getBoundPrincipalId(): string | null {
    return this.boundPrincipalId;
  }

  getSession(): WorkspaceSession | undefined {
    return this.session;
  }

  /**
   * Return the session for `principalId`, creating a fresh one when the
   * bound principal differs (including first bind after retire).
   */
  bind(principalId: string): WorkspaceSession {
    if (!principalId) {
      throw new Error("principalId is required to bind a WorkspaceSession");
    }
    if (
      this.session &&
      !shouldReplaceWorkspaceSession(this.boundPrincipalId, principalId)
    ) {
      return this.session;
    }
    this.session?.dispose();
    this.session = this.create();
    this.boundPrincipalId = principalId;
    return this.session;
  }

  /** Drop any cached session so prior Canvas state cannot resurface. */
  retire(): void {
    this.session?.dispose();
    this.session = undefined;
    this.boundPrincipalId = null;
  }
}

export function createDefaultWorkspaceSession(
  options: WorkspaceSessionOptions,
): WorkspaceSession {
  return new WorkspaceSession(options);
}

/**
 * Monotonic generation gate for concurrent auth verifications.
 * Only the latest-started verification may apply/bind its result.
 */
export class AuthVerificationSequencer {
  private latestGeneration = 0;

  /** Reserve a generation for a verification that is about to start. */
  begin(): number {
    this.latestGeneration += 1;
    return this.latestGeneration;
  }

  /** True iff `generation` is still the latest started verification. */
  isLatest(generation: number): boolean {
    return generation === this.latestGeneration;
  }

  /** Invalidate in-flight verifications (e.g. on unmount). */
  invalidate(): void {
    this.latestGeneration += 1;
  }
}

/**
 * Start a verified getUser() check and apply only if this generation is still
 * latest when it resolves. Returns false when the result was ignored as stale.
 */
export async function runVerifiedAuthBind(options: {
  sequencer: AuthVerificationSequencer;
  getUser: () => Promise<AuthUserLike | null>;
  apply: (user: AuthUserLike | null) => void;
}): Promise<boolean> {
  const generation = options.sequencer.begin();
  const user = await options.getUser();
  if (!options.sequencer.isLatest(generation)) {
    return false;
  }
  options.apply(user);
  return true;
}
