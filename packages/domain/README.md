# `@openbento/domain`

Shared **domain/application action contract** for Human UI, WatchBot, and WebMCP.

This package is types + a typed action catalog stub only. **No handlers. No pipeline. No persistence.**

## Contract WatchBot Engineer builds against

| Action | Notes |
| --- | --- |
| `createWatchBot` | Bind a WatchBot to a Canvas. First slice: web/news sources only. |
| `pauseWatchBot` | Pause a bound WatchBot (`paused` lifecycle). |
| `createCard` | **Requires** `provenance` (`sourceUrl`, `title`, `publishedAt`, `sourceType`). |
| `updateCard` | **Requires** the same provenance fields. |

Proposed local records (sketch only — do not apply, do not invent beyond this):

- `WatchBot`
- `WatchBotEvent` / discovery (dedup + novelty)

See `src/actions.ts`, `src/types.ts`, `src/schema.ts`, and `WATCHBOT_SPEC.md`.
