# WEBMCP_SPEC — OpenBento-Next

Canonical: [`docs/OPENBENTO_MASTER_CONTEXT.md`](./docs/OPENBENTO_MASTER_CONTEXT.md) §13.

Status: **Phase 0**. Specify the tool surface. Do not register tools yet.

This repo is the WebMCP Challenge submission codebase. Deadline: **3 September 2026, 1:00pm PDT**.

Tools **are** `@openbento/domain` actions (camelCase names). Register later:

```ts
document.modelContext.registerTool({
  name,
  description,
  inputSchema,
  execute,
});
```

## 1:1 tool surface

| Tool | Domain action |
| --- | --- |
| `createCanvas` | `createCanvas` |
| `renameCanvas` | `renameCanvas` |
| `switchCanvas` | `switchCanvas` |
| `updateCanvasViewport` | `updateCanvasViewport` |
| `createCard` | `createCard` |
| `updateCard` | `updateCard` |
| `moveCard` | `moveCard` |
| `resizeCard` | `resizeCard` |
| `setCardFrame` | `setCardFrame` |
| `createFrame` | `createFrame` |
| `updateFrame` | `updateFrame` |
| `moveFrame` | `moveFrame` |
| `resizeFrame` | `resizeFrame` |
| `createWatchBot` | `createWatchBot` |
| `updateWatchBot` | `updateWatchBot` |
| `pauseWatchBot` | `pauseWatchBot` |
| `resumeWatchBot` | `resumeWatchBot` |
| `getCanvasState` | `getCanvasState` |
| `getWatchBotStatus` | `getWatchBotStatus` |
| `fullscreenFrame` | `fullscreenFrame` (view-only) |

Judges: ChatGPT in-app browser or Chrome 149+ with `chrome://flags/#enable-webmcp-testing`.

`ob.webmcp.tool` analytics: `toolName` + `success`/`fail` only. No input bodies.

No live URL or `registerTool` in this phase.
