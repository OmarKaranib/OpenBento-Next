import type { Point, Rect, Size } from "@openbento/domain";

export const DASHBOARD_BREAK_FREE_SCREEN_PX = 180;
export const DASHBOARD_BREAK_FREE_HOLD_MS = 300;
const DASHBOARD_LEGACY_DRIFT_WORLD_PX = 4;

export type DashboardGeometry = { position: Point; size: Size };

export type DashboardDragState = {
  startedInside: boolean;
  escaped: boolean;
  displayedPosition: Point;
  positionOffset: Point;
  resistance: DashboardResistance | null;
  escape: { pointer: Point; position: Point } | null;
};

type DashboardResistance = {
  edges: DashboardEdges;
  pointer: Point;
  startedAt: number;
};

type DashboardEdges = {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
};

/** Persisted Card membership takes precedence over imperfect legacy geometry. */
export function cardDashboardActivity(
  frameId: string | null | undefined,
  primaryFrameId: string,
): boolean | undefined {
  if (frameId === primaryFrameId) return true;
  if (frameId === null) return false;
  return undefined;
}

/**
 * Column membership is persisted as the primary-frame id. Parking is still
 * geometry-derived, so only a small legacy overflow is treated as an active
 * member for an interaction; deliberately parked Columns remain free.
 */
export function columnDashboardActivity(
  frameId: string | null | undefined,
  primaryFrameId: string,
  geometry?: DashboardGeometry,
  dashboard?: Rect | null,
): boolean | undefined {
  if (
    frameId === null ||
    (frameId !== primaryFrameId && frameId !== undefined)
  ) {
    return false;
  }
  if (frameId === undefined) {
    return geometry ? isDashboardGeometryInside(geometry, dashboard) : undefined;
  }
  if (!geometry || !dashboard) return true;
  return isDashboardGeometryInside(geometry, dashboard) ||
    isWithinDashboardLegacyDrift(geometry, dashboard);
}

export function isDashboardGeometryInside(
  geometry: DashboardGeometry,
  dashboard: Rect | null | undefined,
): boolean {
  if (!dashboard) return false;
  return (
    geometry.position.x >= dashboard.x &&
    geometry.position.y >= dashboard.y &&
    geometry.position.x + geometry.size.width <= dashboard.x + dashboard.width &&
    geometry.position.y + geometry.size.height <= dashboard.y + dashboard.height
  );
}

function isWithinDashboardLegacyDrift(
  geometry: DashboardGeometry,
  dashboard: Rect,
): boolean {
  return (
    geometry.position.x >= dashboard.x - DASHBOARD_LEGACY_DRIFT_WORLD_PX &&
    geometry.position.y >= dashboard.y - DASHBOARD_LEGACY_DRIFT_WORLD_PX &&
    geometry.position.x + geometry.size.width <=
      dashboard.x + dashboard.width + DASHBOARD_LEGACY_DRIFT_WORLD_PX &&
    geometry.position.y + geometry.size.height <=
      dashboard.y + dashboard.height + DASHBOARD_LEGACY_DRIFT_WORLD_PX
  );
}

/** Starts an isolated wall interaction; parked objects deliberately start free. */
export function beginDashboardDrag(
  geometry: DashboardGeometry,
  dashboard: Rect | null | undefined,
  semanticActive?: boolean,
): DashboardDragState {
  const startedInside = semanticActive ?? isDashboardGeometryInside(geometry, dashboard);
  const displayedPosition = startedInside && dashboard
    ? clampPositionToDashboard(geometry.position, geometry.size, dashboard)
    : geometry.position;
  return {
    startedInside,
    escaped: false,
    displayedPosition,
    positionOffset: {
      x: displayedPosition.x - geometry.position.x,
      y: displayedPosition.y - geometry.position.y,
    },
    resistance: null,
    escape: null,
  };
}

/**
 * Holds an inside object against the dashboard wall until the raw desired
 * position clears the force-to-escape distance. The returned position is what
 * should be rendered and later persisted for this drag tick.
 */
export function resolveDashboardDrag(
  state: DashboardDragState,
  desiredPosition: Point,
  pointer: Point,
  zoom: number,
  timestamp: number,
  size: Size,
  dashboard: Rect | null | undefined,
): { state: DashboardDragState; position: Point; resisting: boolean } {
  const adjustedDesired = {
    x: desiredPosition.x + state.positionOffset.x,
    y: desiredPosition.y + state.positionOffset.y,
  };
  if (!dashboard || !state.startedInside) {
    return {
      state: { ...state, displayedPosition: adjustedDesired },
      position: adjustedDesired,
      resisting: false,
    };
  }

  if (state.escaped && state.escape) {
    const zoomScale = Math.max(zoom, 0.01);
    const position = {
      x: state.escape.position.x + (pointer.x - state.escape.pointer.x) / zoomScale,
      y: state.escape.position.y + (pointer.y - state.escape.pointer.y) / zoomScale,
    };
    return {
      state: { ...state, displayedPosition: position },
      position,
      resisting: false,
    };
  }

  const edges = dashboardEdges({ position: adjustedDesired, size }, dashboard);
  if (!edges.left && !edges.right && !edges.top && !edges.bottom) {
    return {
      state: { ...state, displayedPosition: adjustedDesired, resistance: null },
      position: adjustedDesired,
      resisting: false,
    };
  }

  const position = clampPositionToDashboard(adjustedDesired, size, dashboard);
  const resistance = continuesResistance(state.resistance, edges)
    ? { ...state.resistance!, edges: mergeEdges(state.resistance!.edges, edges) }
    : { edges, pointer, startedAt: timestamp };

  if (
    pointerResistanceDistance(pointer, resistance) >= DASHBOARD_BREAK_FREE_SCREEN_PX &&
    timestamp - resistance.startedAt >= DASHBOARD_BREAK_FREE_HOLD_MS
  ) {
    const escapePosition = nudgeOutsideWall(position, resistance.edges, zoom);
    return {
      state: {
        ...state,
        escaped: true,
        displayedPosition: escapePosition,
        resistance: null,
        escape: { pointer, position: escapePosition },
      },
      position: escapePosition,
      resisting: false,
    };
  }

  return {
    state: { ...state, displayedPosition: position, resistance },
    position,
    resisting: true,
  };
}

/**
 * Resizing is intentionally stricter than dragging: an object that begins
 * inside the dashboard may not escape it through any resize handle.
 */
export function clampDashboardResize(
  geometry: DashboardGeometry,
  dashboard: Rect | null | undefined,
  minimumSize: Size,
): DashboardGeometry {
  if (!dashboard) return geometry;

  let x = clamp(
    geometry.position.x,
    dashboard.x,
    dashboard.x + dashboard.width - minimumSize.width,
  );
  let y = clamp(
    geometry.position.y,
    dashboard.y,
    dashboard.y + dashboard.height - minimumSize.height,
  );
  const right = clamp(
    geometry.position.x + geometry.size.width,
    dashboard.x + minimumSize.width,
    dashboard.x + dashboard.width,
  );
  const bottom = clamp(
    geometry.position.y + geometry.size.height,
    dashboard.y + minimumSize.height,
    dashboard.y + dashboard.height,
  );
  if (right - x < minimumSize.width) {
    x = right - minimumSize.width;
  }
  if (bottom - y < minimumSize.height) {
    y = bottom - minimumSize.height;
  }
  return {
    position: { x, y },
    size: {
      width: right - x,
      height: bottom - y,
    },
  };
}

function dashboardEdges(geometry: DashboardGeometry, dashboard: Rect): DashboardEdges {
  return {
    left: geometry.position.x < dashboard.x,
    right: geometry.position.x + geometry.size.width > dashboard.x + dashboard.width,
    top: geometry.position.y < dashboard.y,
    bottom: geometry.position.y + geometry.size.height > dashboard.y + dashboard.height,
  };
}

function continuesResistance(
  resistance: DashboardResistance | null,
  edges: DashboardEdges,
): boolean {
  if (!resistance) return false;
  return (
    (resistance.edges.left && edges.left) ||
    (resistance.edges.right && edges.right) ||
    (resistance.edges.top && edges.top) ||
    (resistance.edges.bottom && edges.bottom)
  );
}

function mergeEdges(first: DashboardEdges, second: DashboardEdges): DashboardEdges {
  return {
    left: first.left || second.left,
    right: first.right || second.right,
    top: first.top || second.top,
    bottom: first.bottom || second.bottom,
  };
}

function pointerResistanceDistance(pointer: Point, resistance: DashboardResistance): number {
  const horizontal = Math.max(
    resistance.edges.left ? resistance.pointer.x - pointer.x : 0,
    resistance.edges.right ? pointer.x - resistance.pointer.x : 0,
    0,
  );
  const vertical = Math.max(
    resistance.edges.top ? resistance.pointer.y - pointer.y : 0,
    resistance.edges.bottom ? pointer.y - resistance.pointer.y : 0,
    0,
  );
  return Math.hypot(horizontal, vertical);
}

function nudgeOutsideWall(position: Point, edges: DashboardEdges, zoom: number): Point {
  const nudge = 1 / Math.max(zoom, 0.01);
  return {
    x: position.x + (edges.left ? -nudge : edges.right ? nudge : 0),
    y: position.y + (edges.top ? -nudge : edges.bottom ? nudge : 0),
  };
}

function clampPositionToDashboard(position: Point, size: Size, dashboard: Rect): Point {
  return {
    x: clamp(position.x, dashboard.x, dashboard.x + dashboard.width - size.width),
    y: clamp(position.y, dashboard.y, dashboard.y + dashboard.height - size.height),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}
