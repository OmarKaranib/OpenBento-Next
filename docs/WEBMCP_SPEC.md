# WEBMCP_SPEC — OpenBento-Next

Status: **scaffold**. Challenge alignment and intended tool surface. **Do not implement tools yet.**

## Challenge alignment

This repo is the **submission codebase** for the [WebMCP Challenge](https://webmcp.devpost.com/rules).

| Requirement | This repo |
| --- | --- |
| Public repository | `OmarKaranib/OpenBento-Next` |
| Detectable open-source license | MIT `LICENSE` at repo root (GitHub About) |
| Working live URL | **Later.** No deploy this phase. |
| Demo video &lt; 3 minutes | **Later.** |
| Tools via `document.modelContext.registerTool` | Specified; not registered yet |

Deadline: **September 3, 2026, 1:00pm PDT**.

Judges use **ChatGPT’s in-app browser** or **Chrome 149+** with `chrome://flags/#enable-webmcp-testing` enabled.

See `HACKATHON.md` for submission and judging detail.

## Tools = shared domain actions

WebMCP tools **are** `@openbento/domain` actions. Same `name`, same `description`, same `inputSchema`, later the same `execute` path as Human UI and WatchBot.

Intended registration (not implemented):

```ts
document.modelContext.registerTool({
  name,
  description,
  inputSchema,
  execute,
});
```

Feature-detect `document.modelContext` (and fall back only for browsers without WebMCP). Do not invent a parallel tool list.

## Intended tool surface (1:1 catalog)

| Tool name | Domain action | Notes |
| --- | --- | --- |
| `createWatchBot` | `createWatchBot` | Bind WatchBot to a Canvas; first slice web/news. |
| `pauseWatchBot` | `pauseWatchBot` | Pause discovery. |
| `createCard` | `createCard` | **Requires** provenance. |
| `updateCard` | `updateCard` | **Requires** provenance. |
| `setCardFrame` | `setCardFrame` | Membership from spatial containment; `frameId` or `null`. |

Provenance fields the agent must supply on card tools: `sourceUrl`, `title`, `publishedAt`, `sourceType`.

`ACTION_CATALOG` / `ACTION_CATALOG_LIST` in `@openbento/domain` are the source of truth for names and JSON Schema. When the catalog grows, WebMCP grows with it — never ahead of it.

## Non-goals this phase

- No `registerTool` calls
- No execute handlers
- No live URL
- No Chrome extension / origin-trial wiring beyond documentation
