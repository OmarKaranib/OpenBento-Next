# WATCHBOT_SPEC — OpenBento-Next

Status: **scaffold**. Runtime contract and first-slice plan. **No implementation.**

## What a WatchBot is

A WatchBot is a live **observer/actor bound to a Canvas**. It watches sources relevant to that Canvas and writes intelligence as Cards.

- Status is shown **top-left**, next to the current Canvas name/selector.
- It **must** use the same domain actions as the human UI and WebMCP (`@openbento/domain`).
- It does not have a private write API.

## Shared actions (build against these)

| Action | WatchBot use |
| --- | --- |
| `createWatchBot` | Bind a bot to a `canvasId`. First slice `sourceTypes`: `web`, `news`. |
| `pauseWatchBot` | Stop discovering. Lifecycle → `paused`. |
| `createCard` | Materialize a novel, relevant item. **Provenance required.** |
| `updateCard` | Refresh an existing Card. **Provenance required.** |
| `setCardFrame` | If a Card is placed inside/outside a Frame, apply membership here — not a private field. |

Provenance (required on both card actions):

- `sourceUrl`
- `title`
- `publishedAt`
- `sourceType`

Types: `WatchBot`, `WatchBotEvent`, `CardProvenance` in `@openbento/domain`. Proposed local rows: `WatchBotRecord`, `WatchBotEventRecord` in `packages/domain/src/schema.ts`.

## Lifecycle stub

```
idle → watching → acting
         ↓
      paused
         ↓
      error
```

| Status | Meaning |
| --- | --- |
| `idle` | Bound (or unbound) and not watching. |
| `watching` | Discovering / polling. Shown top-left. |
| `acting` | Executing a domain action (typically `createCard` / `updateCard`). |
| `paused` | `pauseWatchBot` — no discovery. |
| `error` | Last cycle failed; `lastError` may be set. |

No scheduler is implemented in this phase.

## Records for dedup and novelty

`WatchBotEvent` **is** the discovery record. Do not invent a second store.

- **Dedup:** `dedupKey` / `dedup_key` unique per `watchBotId`. Built from normalized URL and, when needed, title + `published_at` (or a content hash). Kind `duplicate` when the key already exists.
- **Novelty:** compare the new item to prior events for this bot/canvas (`noveltyScore`, `discoveredAt`). Kind `novel` when it passes. Low novelty does not create a Card.

Pipeline kinds on the same record: `discovered` → `normalized` → `duplicate` | `novel` → `rejected_relevance` | `card_created` | `error`.

## WatchBot Engineer — first slice (do not implement here)

Work lands in **`apps/worker` on a branch after this scaffold merges**. Types and the schema sketch already exist. **No invented schema. No merge to `main` without Bento Lead review.**

### Scope

- **web/news only.** `FirstSliceSourceType = "web" | "news"`.
- **YouTube and X come after web is honest.** Do not add those source types to the worker slice until the web path is real (dedup, novelty, provenance, Cards).

### SourceProvider

- Provider-agnostic port: `SourceProvider` in `@openbento/watchbot` (`packages/watchbot/src/provider.ts`).
- **First adapter: xAI / Grok.** Planned only. Not implemented. **Not wired into `packages/domain`.** Domain stays vendor-free.
- Domain must not import Grok, xAI, or any adapter.

### Pipeline

```
discover → normalize → dedup → novelty → relevance → provenance → Card
```

| Stage | Contract |
| --- | --- |
| discover | `SourceProvider.discover` → `DiscoveredItem[]` (web/news). |
| normalize | Canonical URL, title, `publishedAt`, `sourceType`. |
| dedup | Lookup `WatchBotEvent.dedupKey`. Drop / mark `duplicate`. |
| novelty | Score vs prior events. Mark `novel` or stop. |
| relevance | Canvas-scoped filter. Reject → `rejected_relevance`. |
| provenance | Fill required `CardProvenance`. No Card without it. |
| Card | `createCard` or `updateCard` only. Then `card_created`. |

No job system, queue, or cron in this scaffold. The worker `src/index.ts` is a placeholder.

### What “do not implement” means

- No handlers in `packages/domain`.
- No Grok client, no HTTP calls, no secrets.
- No SQL under `supabase/migrations` (folder stays empty of real migrations).
- No chrome, no canvas wiring.

## Package map

| Location | Role now |
| --- | --- |
| `packages/domain` | Actions, types, schema sketch |
| `packages/watchbot` | `SourceProvider`, pipeline stage names, lifecycle types |
| `apps/worker` | Future first-slice home (stub only) |
| `apps/web` | Later: status in the top-left chrome |

See `ARCHITECTURE.md` and `DECISIONS.md`.
