# WEBMCP_SPEC — OpenBento-Next

Canonical: [`docs/OPENBENTO_MASTER_CONTEXT.md`](./docs/OPENBENTO_MASTER_CONTEXT.md) §13 and [Issue #1](https://github.com/OmarKaranib/OpenBento-Next/issues/1).

Status: **Phase 0**. Do not register tools yet.

WebMCP tool names are **snake_case**. Domain actions are **camelCase**. This is the **only** tool map. Tools not listed here are out of scope. No demo-only tools. No second camelCase tool list.

Register later:

```ts
document.modelContext.registerTool({
  name,          // snake_case tool name from this map
  description,
  inputSchema,   // schema of the mapped domain action
  execute,       // same handler as the mapped domain action
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

Judges: ChatGPT in-app browser or Chrome 149+ with `chrome://flags/#enable-webmcp-testing`.

`ob.webmcp.tool` analytics: `toolName` (snake_case) + `success`/`fail` only. No input bodies.

Deadline: **3 September 2026, 1:00pm PDT**. No live URL or `registerTool` in this phase.
