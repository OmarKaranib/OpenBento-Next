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

Provenance is required on externally discovered source Cards only. Notes do not get a fake source URL. `moveCard` / `resizeCard` do not re-require provenance.

Overlapping Frames: smallest containing Frame wins `setCardFrame`.

WatchBot status: `running` | `paused` | `error` only.
