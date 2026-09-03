/**
 * Camera restore must stay independent of session revision.
 * External poll publish() bumps revision; zoom/pan must not move.
 */

export function shouldApplyStoredViewport(args: {
  previousCanvasId: string | null | undefined;
  nextCanvasId: string | null | undefined;
  previousFullscreenActive?: boolean;
  fullscreenActive: boolean;
  revisionChanged: boolean;
}): "fit" | "restore" | "keep" {
  if (args.fullscreenActive) {
    return "fit";
  }
  if (args.previousCanvasId !== args.nextCanvasId) {
    return "restore";
  }
  if (args.previousFullscreenActive && !args.fullscreenActive) {
    return "restore";
  }
  if (args.revisionChanged) {
    return "keep";
  }
  return "keep";
}
