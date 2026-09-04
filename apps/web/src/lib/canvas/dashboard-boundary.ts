import type { Point, Rect, Size } from "@openbento/domain";

export const DASHBOARD_BREAK_FREE_DISTANCE = 48;

export type DashboardGeometry = { position: Point; size: Size };

export type DashboardDragState = {
  startedInside: boolean;
  escaped: boolean;
  displayedPosition: Point;
};

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

/** Starts an isolated wall interaction; parked objects deliberately start free. */
export function beginDashboardDrag(
  geometry: DashboardGeometry,
  dashboard: Rect | null | undefined,
): DashboardDragState {
  return {
    startedInside: isDashboardGeometryInside(geometry, dashboard),
    escaped: false,
    displayedPosition: geometry.position,
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
  size: Size,
  dashboard: Rect | null | undefined,
): { state: DashboardDragState; position: Point; resisting: boolean } {
  if (!dashboard || !state.startedInside || state.escaped) {
    return {
      state: { ...state, displayedPosition: desiredPosition },
      position: desiredPosition,
      resisting: false,
    };
  }

  const overflow = dashboardOverflow({ position: desiredPosition, size }, dashboard);
  if (Math.max(overflow.left, overflow.right, overflow.top, overflow.bottom) > DASHBOARD_BREAK_FREE_DISTANCE) {
    return {
      state: { ...state, escaped: true, displayedPosition: desiredPosition },
      position: desiredPosition,
      resisting: false,
    };
  }

  const position = clampPositionToDashboard(desiredPosition, size, dashboard);
  const resisting = position.x !== desiredPosition.x || position.y !== desiredPosition.y;
  return {
    state: { ...state, displayedPosition: position },
    position,
    resisting,
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

function dashboardOverflow(geometry: DashboardGeometry, dashboard: Rect) {
  return {
    left: Math.max(0, dashboard.x - geometry.position.x),
    right: Math.max(
      0,
      geometry.position.x + geometry.size.width - (dashboard.x + dashboard.width),
    ),
    top: Math.max(0, dashboard.y - geometry.position.y),
    bottom: Math.max(
      0,
      geometry.position.y + geometry.size.height - (dashboard.y + dashboard.height),
    ),
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
