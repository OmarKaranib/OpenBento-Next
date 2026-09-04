import { describe, expect, it } from "vitest";
import {
  DASHBOARD_BREAK_FREE_DISTANCE,
  beginDashboardDrag,
  clampDashboardResize,
  resolveDashboardDrag,
} from "./dashboard-boundary";

const dashboard = { x: 0, y: 0, width: 1600, height: 900 };
const card = { position: { x: 100, y: 100 }, size: { width: 240, height: 160 } };

function move(
  position: { x: number; y: number },
  state = beginDashboardDrag(card, dashboard),
) {
  return resolveDashboardDrag(state, position, card.size, dashboard);
}

describe("dashboard drag wall", () => {
  it("holds an inside Card at every wall until the intended movement breaks free", () => {
    expect(move({ x: 1380, y: 100 }).position).toEqual({ x: 1360, y: 100 });
    expect(move({ x: -10, y: 100 }).position).toEqual({ x: 0, y: 100 });
    expect(move({ x: 100, y: -10 }).position).toEqual({ x: 100, y: 0 });
    expect(move({ x: 100, y: 760 }).position).toEqual({ x: 100, y: 740 });
  });

  it("keeps a Card at the wall below 48px, then releases it for the drag remainder", () => {
    const held = move({ x: 1360 + DASHBOARD_BREAK_FREE_DISTANCE, y: 100 });
    expect(held.position).toEqual({ x: 1360, y: 100 });
    expect(held.resisting).toBe(true);
    const escaped = move({ x: 1361 + DASHBOARD_BREAK_FREE_DISTANCE, y: 100 }, held.state);
    expect(escaped.position).toEqual({ x: 1409, y: 100 });
    expect(escaped.state.escaped).toBe(true);
    expect(move({ x: 1200, y: 100 }, escaped.state).position).toEqual({ x: 1200, y: 100 });
  });

  it("uses identical wall behavior for Columns, while parked objects remain free and can re-enter", () => {
    const column = { position: { x: 1200, y: 60 }, size: { width: 320, height: 780 } };
    expect(
      resolveDashboardDrag(beginDashboardDrag(column, dashboard), { x: 1320, y: 60 }, column.size, dashboard).position,
    ).toEqual({ x: 1280, y: 60 });

    const parked = { ...card, position: { x: -100, y: 100 } };
    expect(
      resolveDashboardDrag(beginDashboardDrag(parked, dashboard), { x: -200, y: 100 }, parked.size, dashboard).position,
    ).toEqual({ x: -200, y: 100 });
    expect(
      resolveDashboardDrag(beginDashboardDrag(parked, dashboard), { x: 100, y: 100 }, parked.size, dashboard).position,
    ).toEqual({ x: 100, y: 100 });
  });

  it("resets state for each interaction", () => {
    const escaped = move({ x: 1410, y: 100 }).state;
    expect(escaped.escaped).toBe(true);
    expect(beginDashboardDrag(card, dashboard).escaped).toBe(false);
  });
});

describe("dashboard resize wall", () => {
  const minimum = { width: 200, height: 120 };

  it("hard-clamps right, bottom, left, top, and corner resizes without a break-free path", () => {
    expect(clampDashboardResize({ position: { x: 1400, y: 100 }, size: { width: 400, height: 160 } }, dashboard, minimum)).toEqual({ position: { x: 1400, y: 100 }, size: { width: 200, height: 160 } });
    expect(clampDashboardResize({ position: { x: 100, y: 800 }, size: { width: 240, height: 200 } }, dashboard, minimum)).toEqual({ position: { x: 100, y: 780 }, size: { width: 240, height: 120 } });
    expect(clampDashboardResize({ position: { x: -30, y: -20 }, size: { width: 400, height: 300 } }, dashboard, minimum)).toEqual({ position: { x: 0, y: 0 }, size: { width: 370, height: 280 } });
    expect(clampDashboardResize({ position: { x: -30, y: 820 }, size: { width: 1800, height: 300 } }, dashboard, minimum)).toEqual({ position: { x: 0, y: 780 }, size: { width: 1600, height: 120 } });
  });

  it("keeps Column minimum sizes while containing its resize geometry", () => {
    expect(
      clampDashboardResize(
        { position: { x: 1400, y: 700 }, size: { width: 320, height: 320 } },
        dashboard,
        { width: 280, height: 320 },
      ),
    ).toEqual({ position: { x: 1320, y: 580 }, size: { width: 280, height: 320 } });
  });
});
