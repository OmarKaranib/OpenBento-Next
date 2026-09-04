import { describe, expect, it } from "vitest";
import {
  DASHBOARD_BREAK_FREE_HOLD_MS,
  DASHBOARD_BREAK_FREE_SCREEN_PX,
  beginDashboardDrag,
  cardDashboardActivity,
  clampDashboardResize,
  columnDashboardActivity,
  resolveDashboardDrag,
  type DashboardDragState,
} from "./dashboard-boundary";

const dashboard = { x: 0, y: 0, width: 1600, height: 900 };
const card = {
  position: { x: 100, y: 100 },
  size: { width: 240, height: 160 },
};

function start(
  geometry = card,
  semanticActive: boolean | undefined = true,
): DashboardDragState {
  return beginDashboardDrag(geometry, dashboard, semanticActive);
}

function drag(
  state: DashboardDragState,
  desiredPosition: { x: number; y: number },
  pointer: { x: number; y: number },
  timestamp: number,
  zoom = 1,
  size = card.size,
) {
  return resolveDashboardDrag(
    state,
    desiredPosition,
    pointer,
    zoom,
    timestamp,
    size,
    dashboard,
  );
}

describe("screen-space dashboard drag wall", () => {
  it("uses persisted Card membership and Column parked state as the primary activity signal", () => {
    expect(cardDashboardActivity("primary", "primary")).toBe(true);
    expect(cardDashboardActivity(null, "primary")).toBe(false);
    expect(cardDashboardActivity(undefined, "primary")).toBeUndefined();
    expect(columnDashboardActivity(false)).toBe(true);
    expect(columnDashboardActivity(true)).toBe(false);
  });

  it("stops an active Card exactly at the right wall below the release distance", () => {
    const contact = drag(start(), { x: 1380, y: 100 }, { x: 0, y: 0 }, 0);
    expect(contact.position).toEqual({ x: 1360, y: 100 });
    expect(contact.resisting).toBe(true);
    expect(
      drag(contact.state, { x: 1500, y: 100 }, { x: 60, y: 0 }, 200).position,
    ).toEqual({ x: 1360, y: 100 });
    expect(
      drag(contact.state, { x: 1500, y: 100 }, { x: 119, y: 0 }, 200).position,
    ).toEqual({ x: 1360, y: 100 });
  });

  it("requires 120 screen pixels and the short hold before releasing", () => {
    const contact = drag(start(), { x: 1380, y: 100 }, { x: 0, y: 0 }, 0);
    const beforeHold = drag(
      contact.state,
      { x: 1500, y: 100 },
      { x: DASHBOARD_BREAK_FREE_SCREEN_PX, y: 0 },
      DASHBOARD_BREAK_FREE_HOLD_MS - 1,
    );
    expect(beforeHold.state.escaped).toBe(false);
    const escaped = drag(
      beforeHold.state,
      { x: 1500, y: 100 },
      { x: DASHBOARD_BREAK_FREE_SCREEN_PX, y: 0 },
      DASHBOARD_BREAK_FREE_HOLD_MS,
    );
    expect(escaped.state.escaped).toBe(true);
    expect(escaped.position).toEqual({ x: 1361, y: 100 });
  });

  it("measures resistance in screen space regardless of React Flow zoom", () => {
    const lowZoomContact = drag(start(), { x: 1380, y: 100 }, { x: 0, y: 0 }, 0, 0.25);
    const highZoomContact = drag(start(), { x: 1380, y: 100 }, { x: 0, y: 0 }, 0, 2);
    expect(
      drag(lowZoomContact.state, { x: 1800, y: 100 }, { x: 119, y: 0 }, 200, 0.25).state.escaped,
    ).toBe(false);
    expect(
      drag(highZoomContact.state, { x: 1450, y: 100 }, { x: 119, y: 0 }, 200, 2).state.escaped,
    ).toBe(false);
  });

  it("absorbs resistance on release, then follows subsequent pointer movement normally", () => {
    const contact = drag(start(), { x: 1380, y: 100 }, { x: 0, y: 0 }, 0);
    const escaped = drag(contact.state, { x: 1500, y: 100 }, { x: 120, y: 0 }, 150);
    expect(escaped.position).toEqual({ x: 1361, y: 100 });
    expect(
      drag(escaped.state, { x: 1510, y: 100 }, { x: 140, y: 0 }, 180).position,
    ).toEqual({ x: 1381, y: 100 });
  });

  it("resets drag state and applies the same wall to left, top, bottom, and corners", () => {
    expect(drag(start(), { x: -10, y: 100 }, { x: 0, y: 0 }, 0).position).toEqual({ x: 0, y: 100 });
    expect(drag(start(), { x: 100, y: -10 }, { x: 0, y: 0 }, 0).position).toEqual({ x: 100, y: 0 });
    expect(drag(start(), { x: 100, y: 760 }, { x: 0, y: 0 }, 0).position).toEqual({ x: 100, y: 740 });
    const corner = drag(start(), { x: 1380, y: 760 }, { x: 0, y: 0 }, 0);
    expect(corner.position).toEqual({ x: 1360, y: 740 });
    expect(
      drag(corner.state, { x: 1500, y: 800 }, { x: 84, y: 84 }, 200).state.escaped,
    ).toBe(false);
    expect(beginDashboardDrag(card, dashboard, true).escaped).toBe(false);
  });

  it("uses semantic activity to normalize legacy geometry but keeps parked objects free", () => {
    const legacyActive = beginDashboardDrag(
      { position: { x: 1365, y: 100 }, size: card.size },
      dashboard,
      true,
    );
    expect(legacyActive.startedInside).toBe(true);
    expect(legacyActive.displayedPosition).toEqual({ x: 1360, y: 100 });

    const parked = start({ ...card, position: { x: -100, y: 100 } }, false);
    expect(
      drag(parked, { x: -220, y: 100 }, { x: 80, y: 0 }, 200).position,
    ).toEqual({ x: -220, y: 100 });
    expect(
      drag(parked, { x: 100, y: 100 }, { x: 120, y: 0 }, 220).position,
    ).toEqual({ x: 100, y: 100 });
  });

  it("uses the same semantic wall behavior for active Columns", () => {
    const column = {
      position: { x: 1200, y: 60 },
      size: { width: 320, height: 780 },
    };
    const active = beginDashboardDrag(column, dashboard, true);
    expect(
      drag(active, { x: 1320, y: 60 }, { x: 0, y: 0 }, 0, 1, column.size).position,
    ).toEqual({ x: 1280, y: 60 });
    const parked = beginDashboardDrag(
      { ...column, position: { x: 1700, y: 60 } },
      dashboard,
      false,
    );
    expect(
      drag(parked, { x: 1750, y: 60 }, { x: 50, y: 0 }, 100, 1, column.size).position,
    ).toEqual({ x: 1750, y: 60 });
  });
});

describe("dashboard resize wall", () => {
  const minimum = { width: 200, height: 120 };

  it("hard-clamps active Card resize on every edge and corner without break-free", () => {
    expect(clampDashboardResize({ position: { x: 1400, y: 100 }, size: { width: 400, height: 160 } }, dashboard, minimum)).toEqual({ position: { x: 1400, y: 100 }, size: { width: 200, height: 160 } });
    expect(clampDashboardResize({ position: { x: 100, y: 800 }, size: { width: 240, height: 200 } }, dashboard, minimum)).toEqual({ position: { x: 100, y: 780 }, size: { width: 240, height: 120 } });
    expect(clampDashboardResize({ position: { x: -30, y: -20 }, size: { width: 400, height: 300 } }, dashboard, minimum)).toEqual({ position: { x: 0, y: 0 }, size: { width: 370, height: 280 } });
    expect(clampDashboardResize({ position: { x: -30, y: 820 }, size: { width: 1800, height: 300 } }, dashboard, minimum)).toEqual({ position: { x: 0, y: 780 }, size: { width: 1600, height: 120 } });
  });

  it("contains active Column resize while preserving its minimum size", () => {
    expect(
      clampDashboardResize(
        { position: { x: 1400, y: 700 }, size: { width: 320, height: 320 } },
        dashboard,
        { width: 280, height: 320 },
      ),
    ).toEqual({ position: { x: 1320, y: 580 }, size: { width: 280, height: 320 } });
  });
});
