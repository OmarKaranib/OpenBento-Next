"use client";

import { useEffect } from "react";
import { acquireExternalCanvasRefresh } from "@/lib/domain/external-canvas-refresh";
import type { WorkspaceSession } from "@/lib/domain/workspace-session";

/**
 * Poll current-Canvas state while this tab is visible.
 * Identity stays on the verified WorkspaceSession from the binder —
 * never JWT / session.user.
 */
export function useExternalCanvasRefresh(
  session: WorkspaceSession | null,
): void {
  useEffect(() => {
    if (!session) {
      return;
    }
    return acquireExternalCanvasRefresh(session);
  }, [session]);
}
