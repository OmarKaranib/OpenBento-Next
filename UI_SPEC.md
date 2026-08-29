# UI_SPEC — OpenBento-Next

Canonical: [`docs/OPENBENTO_MASTER_CONTEXT.md`](./docs/OPENBENTO_MASTER_CONTEXT.md) §5–6, §21.

Status: **Phase 0**. Chrome is specified, not built.

North star: Railway’s **interaction language** (dark dotted workspace, compact chrome). Do not copy Railway trademarks or assets.

## Surface

- Dark infinite dotted canvas. Cards are free-positioned surfaces, not a packed grid.
- Engine later: `@xyflow/react`. No graph edges, handles, or minimap by default.
- **Zoom is camera-only.** No semantic zoom. The same Cards remain Cards at every zoom.
- Viewport persistence uses `updateCanvasViewport`, not a different information layer.

## Left rail

Compact, icon-first. Not a wide sidebar.

| Item | Placement |
| --- | --- |
| OpenBento mark | Top |
| **Canvases** | Rail body — full Canvas management |
| **WatchBots** | Rail body — account-wide bots |
| **Settings** | Rail body |
| **Profile** | **Fixed at the bottom** |

## Top area

- **Top-left:** current Canvas selector/name (`OpenBento / {name} ▾`) plus **current-Canvas** WatchBot status (`running` \| `paused` \| `error` only). Click status → compact popover for this Canvas’s bots.
- **Top-right:** **Agent** control. Opens a right-side panel. Not a WatchBot.

Left-rail WatchBots is global. Top-left status is current Canvas only.

## Canvas toolbar (bottom-left)

Railway-like **vertical** stack on the canvas:

- grid/snap if useful
- zoom in / zoom out / fit (camera only)
- Frame tool (draw a bordered region)
- undo / redo
- overview/layers if useful (must not become semantic zoom)

Frame tool: click → crosshair → drag rectangle → name/move/resize.

## Cards and Frames

- Cards are freely positioned and resizable via `moveCard` / `resizeCard`.
- Frame membership **feels geometric**. Internally persist `card.frameId` through `setCardFrame`.
- Overlapping Frames: **smallest containing Frame wins**.
- **Fullscreen Frame** is view-only presentation (`fullscreenFrame`). Chrome hides; Frame + member Cards show; **stored geometry is not rewritten**.

## This phase

No rail, top bar, toolbar, or xyflow mount. Placeholder page only. `CanvasRoot.tsx` is not wired.
