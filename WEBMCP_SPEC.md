# OpenBento WebMCP

**Live judge reference:** [web-production-4d6c9e.up.railway.app/webmcp](https://web-production-4d6c9e.up.railway.app/webmcp)

WebMCP lets an external agent work in the same durable OpenBento workspace as a
person. It creates and organizes persistent Canvases, Cards, Frames, and
WatchBots through the same shared `ACTION_CATALOG` and domain executor used by
the human UI and WatchBot pipeline—never a parallel demo store.

> **AI organizes the story. Sources remain the story.**

## Registered tools

The 13 snake_case tools are the complete WebMCP surface. Each maps one-to-one
to a camelCase domain action; no unlisted or demo-only tools are registered.

| WebMCP tool | Domain action |
| --- | --- |
| `get_canvas_state` | `getCanvasState` |
| `create_canvas` | `createCanvas` |
| `switch_canvas` | `switchCanvas` |
| `create_card` | `createCard` |
| `move_card` | `moveCard` |
| `resize_card` | `resizeCard` |
| `create_frame` | `createFrame` |
| `fullscreen_frame` | `fullscreenFrame` |
| `create_watchbot` | `createWatchBot` |
| `update_watchbot` | `updateWatchBot` |
| `pause_watchbot` | `pauseWatchBot` |
| `resume_watchbot` | `resumeWatchBot` |
| `get_watchbot_status` | `getWatchBotStatus` |

## Shared, persistent, and safe by design

- WebMCP calls use the shared `ACTION_CATALOG` / `createActionExecutor` path
  through authenticated `runBoundAction` execution.
- `ownerId` comes only from the verified Supabase request/session. It is never
  accepted from tool input, a browser, or a model.
- `create_card` rejects direct `frameId` input. After `create_card`,
  `move_card`, or `resize_card`, Frame membership is recalculated from geometry
  through the same bound executor. The smallest containing Frame wins;
  `fullscreen_frame` is view-only.
- Tools fail closed for missing authentication, unknown tools, schema-invalid
  input, and cross-owner resources.
- WebMCP tool calls act on the same persisted Canvas seen by the human UI, so
  agent work remains visible, inspectable, and source-aware.

## Judge testing

1. Open the [hosted Canvas](https://web-production-4d6c9e.up.railway.app) and
   authenticate.
2. Use ChatGPT’s in-app browser or Chrome 149+ with
   `chrome://flags/#enable-webmcp-testing`.
3. Ask the host agent to create a Canvas, add a Note Card, move it into a
   Frame, fullscreen the Frame, or create/manage a WatchBot.
4. Verify every change appears in the same Canvas and survives normal refresh
   and authenticated persistence behavior.

The Canvas registers tools only when the WebMCP API is available. It remains a
fully usable human workspace in ordinary browsers.

## Local testing

Use Node 22.23.2 and pnpm 10.33.3:

```bash
pnpm install --frozen-lockfile
pnpm --filter web dev
pnpm test
```

Open `/` for the Canvas and `/webmcp` for the live tool table. For the complete
repository suite, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
`pnpm --filter web build`.

No provider, worker, or service-role secret belongs in browser code. See
[README.md](./README.md) and [HACKATHON.md](./HACKATHON.md) for product and
judge context.
