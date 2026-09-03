# `@openbento/domain`

Shared **domain/application action contract and handlers** for Human UI, WatchBot, and WebMCP.

Canonical product context: `docs/OPENBENTO_MASTER_CONTEXT.md`.

This package is types, catalog, payload schemas, a persistence **port**, `SupabaseDomainStore`, and the shared `ActionExecutor`. It does not hard-wire Grok or any provider. Runtime persist goes through `getDomainStore()`. Isolated tests may use `InMemoryDomainStore`.

## Locked catalog (23 actions)

| Group | Actions |
| --- | --- |
| Canvas | `createCanvas`, `renameCanvas`, `switchCanvas`, `updateCanvasViewport`, `deleteCanvas` |
| Card | `createCard`, `updateCard`, `moveCard`, `resizeCard`, `setCardFrame`, `deleteCard` |
| Frame | `createFrame`, `updateFrame`, `moveFrame`, `resizeFrame`, `deleteFrame` |
| WatchBot | `createWatchBot` (requires `instruction`), `updateWatchBot`, `pauseWatchBot`, `resumeWatchBot` |
| Read/view | `getCanvasState`, `getWatchBotStatus`, `fullscreenFrame` (view-only) |

`moveCard`, `resizeCard`, and `updateCanvasViewport` are first-class. `ownerId` is server-derived from session and **must not** appear on action inputs. Canvas and WatchBot **records** still carry `ownerId`.

A Card is a discriminated `type` plus a matching `payload` (`{ [K in CardType]: { type: K; payload: CardPayloadByType[K] } }[CardType]`). Notes use `{ text }` and must not include provenance. Source types require `payload.provenance`. Shared `PAYLOAD_SCHEMAS` back the catalog, `isValidCardPayload`, and handlers. `moveCard` / `resizeCard` do not re-require provenance.

Overlapping Frames: smallest area wins `setCardFrame`. Equal-area ties use newest `createdAt`. `setCardFrame` **must** call `canSetCardFrame` / `assertSameCanvasMembership` before writing membership — do not rely on RLS alone.

WatchBot status: `running` | `paused` | `error` only.

## Executor and store

```ts
import { createActionExecutor, InMemoryDomainStore } from "@openbento/domain";

const executor = createActionExecutor({
  store: new InMemoryDomainStore(),
  ownerId: sessionUserId, // never from the action payload
});

await executor.execute("createCanvas", { name: "Trump News" });
```

`DomainStore` is the persistence port. Runtime `getDomainStore()` returns `SupabaseDomainStore` for UI, WebMCP, and `runBoundAction` (user JWT only; never `SUPABASE_SERVICE_ROLE_KEY`). The worker uses `createWorkerDomainStore()`. Tests use `InMemoryDomainStore`. Next.js wrappers in `apps/web/src/server` resolve the session user from Supabase Auth and call this executor.

WebMCP tools use `WEBMCP_TOOL_TO_ACTION` + `createWebMcpRuntime({ execute })`. Production `execute` is `runBoundAction({ getOwnerId: requireOwnerIdFromRequest, store: getDomainStore() })` in `apps/web`. This package does not construct a session `ownerId`.

The three destructive actions are intentionally absent from the WebMCP and Interactive Agent allowlists. The human UI invokes them through the same session-bound executor. Card deletion preserves WatchBot event history with a null Card link; Frame deletion first clears membership without changing Card geometry; Canvas deletion relies on the database's owned child cascades.

SQL matching `src/schema.ts` lives in `supabase/migrations`. **Local/dev only. Do not apply to production.**
