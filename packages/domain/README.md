# `@openbento/domain`

Shared **domain/application action contract** for Human UI, WatchBot, and WebMCP.

Canonical product context: `docs/OPENBENTO_MASTER_CONTEXT.md`.

This package is types, catalog, and pure helpers. **No handlers. No pipeline. No persistence.**

## Locked catalog (20 actions)

| Group | Actions |
| --- | --- |
| Canvas | `createCanvas`, `renameCanvas`, `switchCanvas`, `updateCanvasViewport` |
| Card | `createCard`, `updateCard`, `moveCard`, `resizeCard`, `setCardFrame` |
| Frame | `createFrame`, `updateFrame`, `moveFrame`, `resizeFrame` |
| WatchBot | `createWatchBot` (requires `instruction`), `updateWatchBot`, `pauseWatchBot`, `resumeWatchBot` |
| Read/view | `getCanvasState`, `getWatchBotStatus`, `fullscreenFrame` (view-only) |

`moveCard`, `resizeCard`, and `updateCanvasViewport` are first-class. `ownerId` is server-derived from session and **must not** appear on action inputs. Canvas and WatchBot **records** still carry `ownerId`.

A Card is `type` plus a typed `payload`. Notes use `{ text }` and must not include provenance. Source types require `payload.provenance`. `moveCard` / `resizeCard` do not re-require provenance.

Overlapping Frames: smallest area wins `setCardFrame`. Equal-area ties use newest `createdAt`.

WatchBot status: `running` | `paused` | `error` only.
