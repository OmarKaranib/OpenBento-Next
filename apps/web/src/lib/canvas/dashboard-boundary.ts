import type { Point, Rect, Size } from "@openbento/domain";

export const DASHBOARD_EDGE_SNAP_DISTANCE = 16;
export const DASHBOARD_BREAK_FREE_DISTANCE = 32;

export type DashboardGeometry = { position: Point; size: Size };

/**
 * Magnetic dashboard boundary: near-inside and slight-overflow geometry snaps
 * to the physical edge; deliberately parked geometry is left untouched.
 */
export function snapDashboardGeometry(
  geometry: DashboardGeometry,
  dashboard: Rect | null | undefined,
): DashboardGeometry {
  if (!dashboard || geometry.size.width > dashboard.width || geometry.size.height > dashboard.height) {
    return geometry;
  }
  return {
    position: {
      x: snapAxis(geometry.position.x, geometry.size.width, dashboard.x, dashboard.width),
      y: snapAxis(geometry.position.y, geometry.size.height, dashboard.y, dashboard.height),
    },
    size: geometry.size,
  };
}

export function isNearDashboardBoundary(
  geometry: DashboardGeometry,
  dashboard: Rect | null | undefined,
): boolean {
  if (!dashboard) return false;
  const right = geometry.position.x + geometry.size.width;
  const bottom = geometry.position.y + geometry.size.height;
  return [
    geometry.position.x - dashboard.x,
    right - (dashboard.x + dashboard.width),
    geometry.position.y - dashboard.y,
    bottom - (dashboard.y + dashboard.height),
  ].some((distance) => Math.abs(distance) <= DASHBOARD_BREAK_FREE_DISTANCE);
}

function snapAxis(position: number, size: number, start: number, length: number): number {
  const end = start + length - size;
  if (position < start - DASHBOARD_BREAK_FREE_DISTANCE || position > end + DASHBOARD_BREAK_FREE_DISTANCE) {
    return position;
  }
  if (position <= start + DASHBOARD_EDGE_SNAP_DISTANCE) return start;
  if (position >= end - DASHBOARD_EDGE_SNAP_DISTANCE) return end;
  return position;
}
