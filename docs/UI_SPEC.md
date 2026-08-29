# UI_SPEC — OpenBento-Next

Status: **scaffold**. Chrome and canvas interaction contract. Do not implement the canvas in this phase.

North star: **Railway’s canvas interaction model** — compact, dark, spatial, low-chrome. Not a Figma clone. Not a 12-column dashboard.

## Surface

- **Dark infinite dotted canvas.** Background is near-black; dots are a quiet grid, not content.
- The canvas is a viewport over a plane. Objects (Cards, Frames) live in world coordinates.
- **Zoom is camera-only navigation.** Zoom never changes information architecture.
  - No semantic zoom.
  - No “levels” that reveal different object types.
  - No collapsing a Canvas into a Card by zooming out.
  - Fit / zoom in / zoom out / pan only change the camera.
  - A Card at 20% zoom is the same Card as at 200% zoom.
  - Zoom does not change Frame membership or stored geometry.

## Left rail

Compact vertical navigation, Railway-like. Not a wide sidebar.

| Item | Placement |
| --- | --- |
| **Canvases** | Rail body |
| **WatchBots** | Rail body |
| **Settings** | Rail body |
| **Profile** | **Fixed at the bottom** of the rail |

The rail does not contain the Canvas toolbar (that is bottom-left on the canvas). The rail does not host Agent (that is top-right).

## Top area

### Top-left — Canvas context + WatchBot

- **Current Canvas** selector / name.
- **Current Canvas WatchBot status** immediately nearby (same cluster). Status values: `idle` | `watching` | `acting` | `paused` | `error`.
- This cluster is context, not a second nav.

### Top-right — Agent

- **Agent** control / button. Opens the agent conversation that will use WebMCP tools mapped to `packages/domain`.
- Do not put Agent in the left rail or the canvas toolbar.

## Canvas toolbar (bottom-left)

Model **very closely** after Railway’s compact **bottom-left vertical control stack**. Small, icon-first, stacked vertically, sitting on the canvas — not in the rail, not in the top bar.

| Control | Role | Notes |
| --- | --- | --- |
| Grid / snap | Optional | Include if it helps alignment. Viewport/layout aid only. |
| Zoom in | Required | Navigation only. |
| Zoom out | Required | Navigation only. |
| Fit | Required | Fit contents (or selection) in the viewport. Navigation only. |
| Frame tool | Required | Create a Frame (bordered region). |
| Undo | Required | Shared history. |
| Redo | Required | Shared history. |
| Overview / layers | Optional | Include if useful; must **not** become semantic zoom. |

Toolbar actions that mutate the world (Frame tool, undo/redo, and later `setCardFrame` when a card crosses a Frame boundary) must call the same domain/application layer as WatchBot and WebMCP. Zoom/fit/grid are camera-only and do not change the domain graph.

## Frames

- Bordered display regions on the canvas. They are not zoom tiers and not a semantic hierarchy.
- **Membership is spatial.** A Card is in a Frame when it is placed inside that Frame’s bounds, and out when moved outside. That derivation is applied through the shared domain action `setCardFrame` (`frameId` or `null`). The UI must not invent a private membership field.
- **Fullscreen is view-only presentation.** Entering or exiting fullscreen must **not** rewrite stored Frame bounds or Card geometry. It is not a domain mutation and not a new IA level.
- Creating a Frame is a first-class tool on the bottom-left stack.

## What this phase does not build

- No live `@xyflow/react` graph. `apps/web/src/components/canvas/CanvasRoot.tsx` exists and is **not** wired into the page.
- No rail, top bar, or toolbar implementation.
- The placeholder page is title/copy only.

See `DECISIONS.md` for the recorded UI ADRs.
