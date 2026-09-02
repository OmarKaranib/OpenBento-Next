# UI_SPEC — OpenBento-Next

Canonical: [`docs/OPENBENTO_MASTER_CONTEXT.md`](./OPENBENTO_MASTER_CONTEXT.md) §5–6, §21.

Status: **Phase 3 source Cards** (isolated, on persist). Railway-inspired workspace is mounted in `apps/web`. Note, YouTube, Article, and Web Cards register in the canvas card registry. Mutations use `runBoundAction` + `requireOwnerIdFromRequest` + `getDomainStore()` (`SupabaseDomainStore`).

North star: Railway’s **interaction language** (dark dotted workspace, compact chrome). Do not copy Railway trademarks or assets.

## Surface

- Dark infinite dotted canvas. Cards are free-positioned surfaces, not a packed grid.
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
- **Top-left (monitor):** compact current-Canvas search/filter. Query matches Note text and source provenance titles. Type chips cover note / youtube / article / web / x. Filtering is **presentation-only** (unmatched Cards are omitted from the XYFlow node list). Stored positions, sizes, and frame membership are not rewritten. Frames stay visible for spatial context. Clearing search/filter restores every Card.
- **New since last visit:** browser-local `localStorage` key `openbento:canvas-last-visit:{canvasId}`. Cards with `createdAt` after that timestamp (else `updatedAt` if createdAt is missing) show a New badge. Copy must not imply server unread or sync. lastVisitAt is written on Canvas switch or **Mark seen**.
- **Top-right:** **Agent** control. Opens a right-side placeholder panel. Not a WatchBot. Not in the rail or toolbar.

Left-rail WatchBots is global. Top-left status is current Canvas only.

## Canvas toolbar (bottom-left)

Railway-like **vertical** stack on the canvas:

- grid/snap
- zoom in / zoom out / fit (camera only)
- Frame tool (draw a bordered region)
- undo / redo

Frame tool: click → crosshair → drag rectangle → name/move/resize.

## Cards and Frames

- Cards are freely positioned and resizable via `moveCard` / `resizeCard`.
- Frame membership **feels geometric**. Internally persist `card.frameId` through `setCardFrame` after `selectSmallestContainingFrame` + `canSetCardFrame`.
- Cards are `type` + typed payload via the card registry (Note, YouTube, Article, Web, X). Source types carry provenance on the payload; notes do not.
- Source titles/URLs/snippets are untrusted text. Do not inject source HTML. YouTube playback is the official `youtube.com/embed` player only, lazy-mounted with a live-iframe cap. Unknown `publishedAt` / `discoveredAt` is stored as `""` / omitted and is not shown as a date. Missing provenance is not invented.
- Overlapping Frames: smallest area wins; equal-area ties use newest `createdAt`.
- **Fullscreen Frame** is view-only presentation (`fullscreenFrame`). Chrome hides; Frame + member Cards show; **stored geometry is not rewritten**.

## Shared executor

The workspace calls `createActionExecutor` from `@openbento/domain` (`packages/domain/src/executor.ts`). Persistence is Platform's `DomainStore` port (`getDomainStore()` → `SupabaseDomainStore`). `apps/web` must not reimplement that store. Membership is written only via `setCardFrame`. Reload/login restore is required for PASS.
