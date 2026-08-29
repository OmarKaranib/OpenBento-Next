# ARCHITECTURE — OpenBento-Next

Status: **scaffold**. Monorepo map and contracts. No production schema. No deploy.

## Monorepo

pnpm workspaces + TypeScript throughout.

```
apps/web              Next.js 16 App Router. Placeholder page only.
                      @xyflow/react is a future canvas dependency (not mounted).
apps/worker           Worker stub. WatchBot Engineer first slice lands here
                      *after* this scaffold merges, on a branch.
packages/domain       Shared actions + types + local schema *sketch*. No handlers.
packages/watchbot     Runtime types, SourceProvider port, pipeline stage names.
                      No observer loop. No vendor adapter implementation.
packages/ui           Token / placeholder kit. No chrome.
supabase/migrations   Empty of real migrations. Local/dev only. Do not apply.
docs/                 Maintained copy of the root spec set.
```

Root package: private workspace, `packageManager` pnpm. Build the placeholder with:

```bash
pnpm install
pnpm --filter web build
```

## How the pieces fit

| Piece | Owns | Does not own |
| --- | --- | --- |
| `apps/web` | Human UI, later xyflow + WebMCP registration | Domain rules, WatchBot pipeline, production DB |
| `apps/worker` | Later: discover→…→Card job/pipeline | Domain catalog, UI chrome |
| `packages/domain` | Action names, input/output types, record sketch | Handlers, vendors, SQL migrations |
| `packages/watchbot` | Runtime types, `SourceProvider`, lifecycle docs | Domain actions, Grok wiring into domain |
| `packages/ui` | Future shared chrome primitives | Product features |
| `supabase/migrations` | Future **local/dev** SQL only | Production project (forbidden this phase) |

## Shared action contract

`@openbento/domain` exports `ACTION_CATALOG`. Human UI, WatchBot, and WebMCP **must** use these names and schemas.

WatchBot Engineer builds against (stubs, **no handlers**):

| Action | Input (contract) | Result type |
| --- | --- | --- |
| `createWatchBot` | `canvasId`, optional `sourceTypes` (`web` \| `news`), optional `label` | `WatchBot` |
| `pauseWatchBot` | `watchBotId` | `WatchBot` (`status: "paused"`) |
| `createCard` | `canvasId`, **required** `provenance`, optional body/position | `Card` |
| `updateCard` | `cardId`, **required** `provenance`, optional body/position | `Card` |
| `setCardFrame` | `cardId`, `frameId` (`string` \| `null`) | `Card` |

Provenance on both card actions:

- `sourceUrl` / `source_url`
- `title`
- `publishedAt` / `published_at`
- `sourceType` / `source_type`

WebMCP later registers the same names:

```ts
document.modelContext.registerTool({
  name,          // catalog action name
  description,   // catalog description
  inputSchema,   // catalog inputSchema
  execute,       // later: same handler as UI / WatchBot
});
```

`setCardFrame` is the only way to persist Frame membership. Membership is **derived from spatial containment** (card placed inside / moved outside a Frame) and applied through this action — not invented as a UI-only field.

Fullscreen Frame is **view-only presentation**. It is not a catalog action and must **not** rewrite stored Frame bounds or Card geometry. Zoom remains camera-only (no semantic zoom).

Do not add a second catalog in the worker or in WebMCP glue.

## Data ownership sketch (not applied)

No production database. No migrations to run. Types + comments only in `packages/domain/src/schema.ts`.

### `WatchBot` → proposed `watch_bots`

Bound to a canvas. Lifecycle: `idle` | `watching` | `acting` | `paused` | `error`. First-slice `source_types`: `web`, `news`.

### `WatchBotEvent` / discovery → proposed `watch_bot_events`

One table for discovery **and** pipeline decisions used for **dedup** and **novelty**.

- Dedup: `dedup_key` unique per `watch_bot_id` (normalized URL ± title ± `published_at`, or content hash).
- Novelty: `novelty_score` plus `discovered_at` compared to prior rows for that bot/canvas.
- Do **not** invent a second discovery table or extra join tables in the first slice.

### Card provenance columns

Not a separate provenance table in this sketch. Required columns on any future card row: `source_url`, `title`, `published_at`, `source_type`.

WatchBot Engineer must **not invent schema** beyond this sketch. Persistence, if any, waits for a later local/dev Supabase phase.

## WatchBot Engineer first slice (not in this PR)

Documented so work can start on a branch **after** scaffold merge. See `WATCHBOT_SPEC.md`.

- **web/news only**
- `SourceProvider` is provider-agnostic; first adapter is **xAI/Grok** and is **not wired into the domain**
- Pipeline: discover → normalize → dedup → novelty → relevance → provenance → Card
- YouTube and X after web is honest
- Implementation home: `apps/worker`
- No merge to `main` without **Bento Lead** review

## Non-goals (this phase)

- No deploy (Vercel or otherwise)
- No production Supabase project, no applied migrations, no secrets
- No product features, no working canvas, no job system, no provider calls
- No merge to `main` without approval
- No changes to `OmarKaranib/OpenBento`
