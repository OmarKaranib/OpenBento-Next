# Workspace domain wiring

The Canvas UI does **not** own a store or a second action catalog.

## Import path (Platform / `bot/platform-persist`)

| Export | Package | Source file |
| --- | --- | --- |
| `createActionExecutor` | `@openbento/domain` | `packages/domain/src/executor.ts` |
| `InMemoryDomainStore` / `DomainStore` | `@openbento/domain` | `packages/domain/src/store.ts` |
| `SupabaseDomainStore` / `getDomainStore` | `@openbento/domain` | `packages/domain/src/supabase-store.ts` |
| `ActionInputMap` / `ActionResultMap` | `@openbento/domain` | `packages/domain/src/actions.ts` |
| `assertSameCanvasMembership` / `canSetCardFrame` | `@openbento/domain` | `packages/domain/src/frames.ts` |
| `runDomainAction` / `runBoundAction` | `apps/web` | `apps/web/src/server` |

The UI facade (`WorkspaceSession`) calls `runDomainAction`. The server resolves `ownerId` from Supabase Auth `getUser()` / `auth.uid()` and binds `createActionExecutor({ store, ownerId })`. The browser must not construct the executor with a baked-in owner id. Reload/login restore is required for PASS.

```ts
// apps/web/src/server — request-scoped owner, shared catalog
await runDomainAction("createCard", input);
await runDomainAction("setCardFrame", { cardId, frameId });
```

`setCardFrame` in the executor calls `assertSameCanvasMembership` (and `canSetCardFrame` on that path). The UI only derives a candidate `frameId` with `selectSmallestContainingFrame` and then calls `setCardFrame`. It must not write `card.frameId` itself. Do not fold `frameId` into `createCard`.

Hosted Supabase Auth is the live session. The unsigned `ob_local_session` cookie is not the live path. SQL in `supabase/migrations` is applied to the **dev** project by Platform after review.
