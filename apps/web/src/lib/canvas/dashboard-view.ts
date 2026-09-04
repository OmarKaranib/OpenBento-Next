import type {
  Canvas,
  Frame,
  FrameFullscreenView,
  Rect,
} from "@openbento/domain";

export type DashboardViewSnapshot = {
  currentCanvasId: string | null;
  canvases: readonly Canvas[];
  frames: readonly Frame[];
  fullscreen: FrameFullscreenView | null;
};

export type DashboardViewMode = "fit" | "return" | "fullscreen";

const VIEW_OPTIONS = {
  fit: { padding: 0.06, duration: 200 },
  return: { padding: 0.14, duration: 240 },
  fullscreen: { padding: 0, duration: 0 },
} as const;

export function primaryDashboardFrame(
  snapshot: DashboardViewSnapshot,
): Frame | null {
  const canvas = snapshot.canvases.find(
    (entry) => entry.id === snapshot.currentCanvasId,
  );
  if (!canvas) return null;
  return (
    snapshot.frames.find((frame) => frame.id === canvas.primaryFrameId) ?? null
  );
}

/** Fit commands accept only primary-Frame bounds, never arbitrary Canvas nodes. */
export function dashboardFitRequest(
  frame: Frame,
  mode: DashboardViewMode,
): { bounds: Rect; options: { padding: number; duration: number } } {
  return {
    bounds: { ...frame.bounds },
    options: { ...VIEW_OPTIONS[mode] },
  };
}

export function dashboardFullscreenInput(
  frame: Frame,
  fullscreen: FrameFullscreenView | null,
): { frameId: string; active: boolean } {
  return {
    frameId: frame.id,
    active: !(fullscreen?.active && fullscreen.frameId === frame.id),
  };
}
