# PRODUCT_SPEC — OpenBento-Next

Canonical: [`docs/OPENBENTO_MASTER_CONTEXT.md`](./docs/OPENBENTO_MASTER_CONTEXT.md).

> Tell OpenBento what you want to follow. It builds and maintains a living canvas of the relevant sources, media, reactions, and developments.

**AI organizes the story. Sources remain the story.**

## Primitives

| Primitive | Definition |
| --- | --- |
| **Canvas** | Persistent spatial workspace. Camera zoom only. Viewport persistable. |
| **Card** | Free-positioned content in the primary Frame or an ordered item in a Column. Source types carry provenance; notes do not. |
| **Frame** | Exactly one persisted primary live-dashboard boundary per Canvas. Fullscreen changes presentation, never stored geometry. |
| **Column** | Persisted, movable/resizable vertical Card stream inside the primary Frame. Newest Cards render first. |
| **WatchBot** | Persistent monitor (`running` \| `paused` \| `error`) with one dedicated Column. Requires an instruction. |

Interactive **Agent** (top-right) is not a WatchBot.

## Shared actions

Human, WatchBot, and WebMCP use the full `@openbento/domain` catalog (see `ARCHITECTURE.md`). `ownerId` is never an action input. Provenance is required on source Cards only.

## Users and loops

- **Human:** create/switch Canvas, place Cards and Columns, detach a Column Card into free Frame space, fullscreen, talk to Agent, and pause/resume WatchBots.
- **WatchBot:** follow `instruction` and write sourced Cards to the top of its dedicated Column through the catalog.
- **Agent / WebMCP:** same catalog as tools.

## v1 intent vs this phase

v1 includes Railway chrome, XYFlow canvas, Note + source Cards, a singleton primary Frame, Column streams, WatchBot worker, WebMCP parity, and local/dev Supabase.

Phase 1 establishes the live dashboard: a stable 1600×900 logical primary Frame, free Cards, first-class Columns, dedicated WatchBot delivery, parking outside the Frame, interactive fullscreen, and media-first YouTube Cards. Add/command-bar work, dragging arbitrary free Cards into Columns, X-video redesign, markets, billing, and production infra remain deferred.

Legacy `OmarKaranib/OpenBento` is reference only.
