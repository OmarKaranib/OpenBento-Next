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
    this.session = this.create();
    this.boundPrincipalId = principalId;
    return this.session;
  }

  /** Drop any cached session so prior Canvas state cannot resurface. */
  retire(): void {
    this.session = undefined;
    this.boundPrincipalId = null;
  }
}

export function createDefaultWorkspaceSession(
  options: WorkspaceSessionOptions,
): WorkspaceSession {
  return new WorkspaceSession(options);
}
