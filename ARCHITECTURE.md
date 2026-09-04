# ARCHITECTURE — OpenBento-Next

Canonical product context: [`docs/OPENBENTO_MASTER_CONTEXT.md`](./docs/OPENBENTO_MASTER_CONTEXT.md).

Status: **Dashboard Frame + Columns Phase 1**. Runtime persist is `getDomainStore()` → `SupabaseDomainStore` for UI, WebMCP, and `runBoundAction` (user JWT only). The WatchBot worker uses `createWorkerDomainStore()` (explicit service role). Auth is hosted Supabase (`getUser()` / `auth.uid()`). **Reload / login restore is required for PASS.** No production infra. No in-memory runtime fallback.

## Monorepo

pnpm workspaces + TypeScript. Next.js 16 + React in `apps/web`.

```
apps/web              Next.js 16 App Router. Railway-inspired workspace + login.
                      CanvasRoot mounts @xyflow/react (no edges / minimap).
apps/worker           WatchBot worker. createWorkerDomainStore(); --fixture is tests only.
packages/domain       Catalog + handlers (`ActionExecutor`) + DomainStore port
                      + SupabaseDomainStore.
packages/watchbot     SourceProvider + pipeline. Optional Grok / OpenAI web adapters behind env.
packages/ui           Shared visual tokens for the workspace chrome.
supabase/migrations   Dev SQL + RLS matching schema.ts. Do not apply from this agent.
docs/                 Maintained specs + OPENBENTO_MASTER_CONTEXT.md
```

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter web build
```

## Shared action contract

Human UI, WatchBot, and WebMCP **must** use `@openbento/domain` `ACTION_CATALOG`. Do not land a 5-action stub.

| Group | Actions |
| --- | --- |
| Canvas | `createCanvas`, `renameCanvas`, `switchCanvas`, `updateCanvasViewport` |
| Card | `createCard`, `updateCard`, `moveCard`, `resizeCard`, `setCardFrame`, `setCardColumn`, `detachCardFromColumn` |
| Frame | `createFrame`, `updateFrame`, `moveFrame`, `resizeFrame` |
| Column | `createColumn`, `updateColumn`, `moveColumn`, `resizeColumn` |
| WatchBot | `createWatchBot` (**requires `instruction`**), `updateWatchBot`, `pauseWatchBot`, `resumeWatchBot` |
| Read/view | `getCanvasState`, `getWatchBotStatus`, `fullscreenFrame` |

Locked rules:

- `moveCard`, `resizeCard`, and `updateCanvasViewport` are **first-class**. Do not fold them into `updateCard`.
- `ownerId` is **server-derived from the authenticated session** (`auth.uid()`). It must **not** appear on action inputs. Canvas and WatchBot **records** still carry `ownerId`.
- Provenance is required on **externally discovered source Cards only**. Notes do not get a fake source URL. `moveCard` / `resizeCard` do not re-require provenance.
- A Card is **discriminated `type` + matching `payload`**. Runtime validation uses shared `PAYLOAD_SCHEMAS`.
- Every Canvas has exactly one primary Frame. Canvas creation persists both atomically at stable logical bounds `{x:0,y:0,width:1600,height:900}`. Compatibility `createFrame` accepts only those bounds; `moveFrame`, `resizeFrame`, and `deleteFrame` reject. Only safe metadata rename remains.
- Free Card activity is geometric full containment. Column membership is authoritative `card.columnId`; `setCardColumn` verifies the same Canvas and primary Frame. `detachCardFromColumn` clears only membership and persists the drop geometry on the same Card.
- `fullscreenFrame` is **view state**. It must not rewrite stored Frame, Column, or Card geometry; the UI locks the camera while keeping dashboard contents interactive.
- Zoom / `updateCanvasViewport` is **camera-only**. No semantic zoom.
- WatchBot status: **`running` \| `paused` \| `error`** only.
- `listWatchBots` is a store/worker scan, **not** an `ACTION_CATALOG` name. The worker stamps `ownerId` from the WatchBot record.

WebMCP registers a 15-tool safe snake_case map via `document.modelContext.registerTool`. Frame create/update/move/resize are excluded; `fullscreen_frame` remains view-only. `execute` is `runWebMcpTool` → `runBoundAction({ getOwnerId: requireOwnerIdFromRequest, store: getDomainStore() })`. ownerId is never taken from tool arguments.

## Shared executor and persist

`createActionExecutor({ store, ownerId })` implements every `ACTION_CATALOG` name. `ownerId` is resolved **per request** from Supabase Auth (`requireOwnerIdFromRequest` → `getUser()` / `auth.uid()`) and bound by `runBoundAction` / `runDomainAction`. The unsigned `ob_local_session` cookie is **not** the live path.

`getDomainStore()` returns `SupabaseDomainStore` for UI, WebMCP, and `runBoundAction`, authenticated with the user JWT (publishable/anon + session). It never reads `SUPABASE_SERVICE_ROLE_KEY`. The worker uses `createWorkerDomainStore()`. `InMemoryDomainStore` is isolated tests only.

Leftover-Card TOCTOU: the WatchBot pipeline persists `createCard` + `setCardFrame` + `setCardColumn` + unique `(watch_bot_id, dedup_key)` claim in one `runInTransaction`. A unique conflict rolls back the Card. A thrown create does not occupy the unique key. It checks the dedicated Column before discovery and spends no provider call while that Column is parked.

## Data ownership (dev SQL)

SQL is in `supabase/migrations`. **Do not apply from this agent. Platform applies reviewed SQL to the explicit-dev project.** Shapes live in `packages/domain/src/schema.ts`.

- **Canvas** — `owner_id`, `primary_frame_id`, name, persisted viewport (x, y, zoom)
- **Card** — canvas, optional `frame_id`, optional authoritative `column_id`, type, `jsonb` payload (not title/body)
- **Frame** — exactly one per Canvas, name, stable stored bounds (fullscreen does not rewrite these)
- **Column** — canvas + primary Frame, name, stored bounds/z-index; contents are bounded newest-first streams
- **WatchBot** — `owner_id`, canvas, required unique `column_id`, **instruction**, status `running|paused|error`
- **WatchBotEvent** — discovery/dedup/novelty records. Unique `(watch_bot_id, dedup_key)`. `card_id` is protected by same-canvas composite FK `(card_id, canvas_id) → cards(id, canvas_id)`.

RLS: every table is owner-scoped via `auth.uid()` (cards/frames/columns join through canvas ownership). Handlers still enforce same-Canvas and primary-Frame membership. RLS is not a substitute. Never trust a client-supplied user id.

## Env

Public placeholders only (see `.env.example` and [`docs/DEPLOY.md`](./docs/DEPLOY.md)):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `NEXT_PUBLIC_SITE_URL` (public origin for Auth redirects; placeholder until the Railway URL exists)

Worker uses `SUPABASE_SERVICE_ROLE_KEY` only via `createWorkerDomainStore()` (never `NEXT_PUBLIC_`, never committed, never printed, never on the web `getDomainStore()` path). Hosted worker is fail-closed on `OPENBENTO_WORKER_ENABLED` (default off). Optional `OPENBENTO_WORKER_INTERVAL_MS` has a 300000 ms ceiling.

## Planned infrastructure (config prepared; not provisioned by this PR)

| Platform | Region | Role |
| --- | --- | --- |
| **Supabase** | North Virginia, **us-east-1** | Database, Auth, Storage (dev project already exists) |
| **Railway** | **US East / Virginia** | `apps/web` runtime + `apps/worker` WatchBot worker |

## Observability (not wired)

| System | Role |
| --- | --- |
| **Sentry** | Errors, crashes, performance, worker failures |
| **PostHog** | Product analytics, funnels, retention, feature flags, session behavior, AI/LLM cost analytics |
| **Resend** | Transactional email; future WatchBot alerts/digests |

Event taxonomy: [`docs/ANALYTICS.md`](./docs/ANALYTICS.md). No secrets, instructions, article/social bodies, source HTML, or untrusted payloads.

## Non-goals (this phase)

No X/YouTube discovery, billing/Stripe, production Supabase, Railway services, or deploy. Do not modify `OmarKaranib/OpenBento`. Do not apply migrations to any hosted database from this agent. The Canvas UI must not reimplement the store. WebMCP must not mint a second session owner. Domain must not import Grok/xAI.
