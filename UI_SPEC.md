# UI_SPEC — OpenBento-Next

Canonical: [`docs/OPENBENTO_MASTER_CONTEXT.md`](./docs/OPENBENTO_MASTER_CONTEXT.md) §5–6, §21.

Status: **Phase 1**. Railway-inspired workspace is mounted in `apps/web`.

North star: Railway’s **interaction language** (dark dotted workspace, compact chrome). Do not copy Railway trademarks or assets.

## Surface

- Dark infinite dotted world containing one 1600×900 logical primary Frame. The Frame is the live dashboard; the surrounding world is parking space.
- Free Cards and first-class Columns are spatial surfaces. Column contents are a bounded, newest-first vertical stream with their own scroll container.
- Engine: `@xyflow/react`. No graph edges, handles, or minimap.
- **Zoom is camera-only.** No semantic zoom. The same Cards remain Cards at every zoom.
- Viewport persistence uses `updateCanvasViewport`, not a different information layer.

## Left rail

Compact, icon-first. Not a wide sidebar.

| Item | Placement |
| --- | --- |
| OpenBento mark | Top |
| **Canvases** | Rail body — full Canvas management |
| **WatchBots** | Rail body — account-wide bots (placeholder) |
| **Settings** | Rail body (placeholder) |
| **Profile** | **Fixed at the bottom** |

## Top area

- **Top-left:** current Canvas selector/name (`OpenBento / {name} ▾`) plus **current-Canvas** WatchBot status. Click status → compact popover for this Canvas’s bots.
- **Top-right:** **Agent** control. Opens a right-side placeholder panel. Not a WatchBot. Not in the rail or toolbar.

Left-rail WatchBots is global. Top-left status is current Canvas only.

## Canvas toolbar (bottom-left)

Railway-like **vertical** stack on the canvas:

- grid/snap
- zoom in / zoom out / fit (camera only)
- Add Column
- undo / redo

The primary Frame is created with its Canvas. Human UI does not offer a second-Frame or delete-Frame control.

## Cards, Columns, and the primary Frame

- Cards are freely positioned and resizable via `moveCard` / `resizeCard`.
- A Canvas has exactly one primary Frame. Its stable logical dimensions are independent of monitor pixels.
- Free Card activity is determined by full geometric containment in the primary Frame. Column membership is explicit through `card.columnId`, never inferred from overlap.
- Columns are persisted, movable, resizable (minimum 280×320, maximum 1200×900), and render Cards newest-first by `createdAt`, then `id` as the deterministic tie-break.
- Dragging a Column Card into empty primary-Frame space invokes `detachCardFromColumn`: the same Card is retained, `columnId` is cleared, drop geometry is persisted, and source/WatchBot provenance remains unchanged.
- Cards are `type` + typed payload (Note is first, via the card registry). Source types carry provenance on the payload; notes do not.
- Free Cards and Columns that are not fully contained are parked: dimmed, selectable, and draggable, while editing, links, and active media are frozen.
- **Fullscreen Frame** fits the primary Frame, hides parked space, locks pan/zoom, and leaves active Cards, links, media, selection, geometry editing, and Column scrolling interactive. It never rewrites stored geometry.

## Shared executor

The workspace calls `createActionExecutor` from `@openbento/domain` (`packages/domain/src/executor.ts`). Persistence is Platform's `DomainStore` port (`getDomainStore()` → `SupabaseDomainStore`). `apps/web` must not reimplement that store. Membership is written only through the shared `setCardFrame`, `setCardColumn`, and `detachCardFromColumn` actions. Reload/login restore is required for PASS.
