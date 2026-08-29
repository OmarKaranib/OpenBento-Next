# WEBMCP_SPEC — OpenBento-Next

Canonical: [`docs/OPENBENTO_MASTER_CONTEXT.md`](./docs/OPENBENTO_MASTER_CONTEXT.md) §13 and [Issue #1](https://github.com/OmarKaranib/OpenBento-Next/issues/1).

Status: **Phase 2 (isolated PR)**. Tools are registered. No SQL apply. No deploy.

WebMCP tool names are **snake_case**. Domain actions are **camelCase**. This is the **only** tool map. Tools not listed here are out of scope. No demo-only tools. No second camelCase tool list.

```ts
document.modelContext.registerTool({
  name,          // snake_case tool name from this map
  description,
  inputSchema,   // schema of the mapped domain action
  execute,       // runBoundAction + requireSessionOwnerId → createActionExecutor
});
```

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

`ownerId` is session-derived via `requireSessionOwnerId` / `AuthSessionPort`. It is never accepted on tool arguments. There is no local-session owner fallback on the WebMCP path. An unset session fails closed (`unauthenticated`).

`create_card` is bounds-only. Frame membership is a follow-up `setCardFrame` from `selectSmallestContainingFrame`, still through `runBoundAction`. `fullscreen_frame` is view-only and must not rewrite stored geometry.

## How to run

```bash
pnpm install
pnpm --filter web dev
```

- Canvas (registers tools when `document.modelContext` exists): `/`
- Judge notes + tool table: `/webmcp`

Judges: ChatGPT in-app browser or Chrome 149+ with `chrome://flags/#enable-webmcp-testing`.

## How to eval

```bash
pnpm test
```

Tests configure `AuthSessionPort` and invoke tools through `createBoundWebMcpRuntime` (`apps/web/src/webmcp/bound-runtime.ts`). That function always calls `runBoundAction({ getOwnerId: requireSessionOwnerId, store })`. `createActionExecutor` runs inside `runBoundAction`.

`ob.webmcp.tool` analytics: `toolName` (snake_case) + `success`/`fail` only. No input bodies. Not wired to PostHog in this phase.

Deadline: **3 September 2026, 1:00pm PDT**. No live deploy from this PR.
