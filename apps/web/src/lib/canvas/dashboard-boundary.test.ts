import { describe, expect, it } from "vitest";
import { isNearDashboardBoundary, snapDashboardGeometry } from "./dashboard-boundary";

const dashboard = { x: 0, y: 0, width: 1600, height: 900 };
const card = { size: { width: 240, height: 160 } };

describe("dashboard magnetic boundary", () => {
  it("snaps each Card edge exactly to the dashboard", () => {
    expect(snapDashboardGeometry({ ...card, position: { x: 9, y: 100 } }, dashboard).position.x).toBe(0);
    expect(snapDashboardGeometry({ ...card, position: { x: 1351, y: 100 } }, dashboard).position.x).toBe(1360);
    expect(snapDashboardGeometry({ ...card, position: { x: 100, y: 10 } }, dashboard).position.y).toBe(0);
    expect(snapDashboardGeometry({ ...card, position: { x: 100, y: 733 } }, dashboard).position.y).toBe(740);
  });

  it("pulls slight overflow inside, but leaves deliberately parked geometry alone", () => {
    expect(snapDashboardGeometry({ ...card, position: { x: -20, y: 100 } }, dashboard).position.x).toBe(0);
    expect(snapDashboardGeometry({ ...card, position: { x: -33, y: 100 } }, dashboard).position.x).toBe(-33);
  });

  it("uses the same deterministic behavior for Columns and resize dimensions", () => {
    const column = { position: { x: 1290, y: 60 }, size: { width: 320, height: 780 } };
    expect(snapDashboardGeometry(column, dashboard).position).toEqual({ x: 1280, y: 60 });
    expect(isNearDashboardBoundary(column, dashboard)).toBe(true);
  });
});
