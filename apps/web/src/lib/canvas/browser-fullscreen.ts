/** Browser Fullscreen API boundary for the single Workspace root. */
export type FullscreenDocument = Pick<Document, "fullscreenElement" | "exitFullscreen">;

export type FullscreenElement = HTMLElement & {
  requestFullscreen?: () => Promise<void>;
};

export function workspaceOwnsBrowserFullscreen(
  documentLike: Pick<Document, "fullscreenElement">,
  workspaceElement: Element | null,
): boolean {
  return Boolean(workspaceElement && documentLike.fullscreenElement === workspaceElement);
}

export function shouldDeactivateWorkspaceView(
  activeFrameId: string | undefined,
  documentLike: Pick<Document, "fullscreenElement">,
  workspaceElement: Element | null,
): activeFrameId is string {
  return Boolean(activeFrameId && !workspaceOwnsBrowserFullscreen(documentLike, workspaceElement));
}

/** Invoke directly from a human gesture; unsupported/rejected requests are safe fallbacks. */
export async function requestWorkspaceFullscreen(
  workspaceElement: FullscreenElement | null,
): Promise<boolean> {
  if (!workspaceElement?.requestFullscreen) return false;
  try {
    await workspaceElement.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

export async function exitWorkspaceFullscreen(
  documentLike: FullscreenDocument,
  workspaceElement: Element | null,
): Promise<boolean> {
  if (!workspaceOwnsBrowserFullscreen(documentLike, workspaceElement)) {
    return false;
  }
  try {
    await documentLike.exitFullscreen();
    return true;
  } catch {
    return false;
  }
}
