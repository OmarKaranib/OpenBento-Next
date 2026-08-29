# Workspace domain wiring

The Canvas UI does **not** own a store or a second action catalog.

## Import path (Platform / PR #4 / `bot/platform`)

| Export | Package | Source file |
| --- | --- | --- |
| `createActionExecutor` | `@openbento/domain` | `packages/domain/src/executor.ts` |
| `InMemoryDomainStore` / `DomainStore` | `@openbento/domain` | `packages/domain/src/store.ts` |
| `ActionInputMap` / `ActionResultMap` | `@openbento/domain` | `packages/domain/src/actions.ts` |
| `assertSameCanvasMembership` / `canSetCardFrame` | `@openbento/domain` | `packages/domain/src/frames.ts` |

These exports are on `main` at `492f951` (PR #4). Canvas consumes that API; it does not reimplement `InMemoryDomainStore`.

```ts
import {
  createActionExecutor,
  InMemoryDomainStore,
} from "@openbento/domain";

const executor = createActionExecutor({
  store: new InMemoryDomainStore(),
  ownerId: sessionOwnerId, // never from action input
});

await executor.execute("createCard", input);
await executor.execute("setCardFrame", { cardId, frameId });
```

`setCardFrame` in the executor calls `assertSameCanvasMembership` (and `canSetCardFrame` on that path). The UI only derives a candidate `frameId` with `selectSmallestContainingFrame` and then calls `setCardFrame`. It must not write `card.frameId` itself.

Until Platform session auth lands, the workspace uses a local session owner id. That value is still stamped by `createActionExecutor`, not by action inputs.
