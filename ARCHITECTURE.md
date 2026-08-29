# ARCHITECTURE — OpenBento-Next

Canonical product context: [`docs/OPENBENTO_MASTER_CONTEXT.md`](./docs/OPENBENTO_MASTER_CONTEXT.md).

Status: **Phase 0 foundation**. Types, catalog, docs, lint/typecheck/test/build. No Canvas UI, no WatchBot pipeline, no WebMCP tools, no production infra.

## Monorepo

pnpm workspaces + TypeScript. Next.js 16 + React in `apps/web`.

```
apps/web              Next.js 16 App Router. Placeholder page only.
                      @xyflow/react is a future canvas dependency (not mounted).
apps/worker           WatchBot worker stub. No job system.
packages/domain       Full master action catalog + types + pure helpers.
packages/watchbot     SourceProvider port + runtime types. No adapter.
packages/ui           Token / placeholder kit.
supabase/migrations   Empty of real migrations. Local/dev only. Do not apply.
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
| Card | `createCard`, `updateCard`, `moveCard`, `resizeCard`, `setCardFrame` |
| Frame | `createFrame`, `updateFrame`, `moveFrame`, `resizeFrame` |
| WatchBot | `createWatchBot` (**requires `instruction`**), `updateWatchBot`, `pauseWatchBot`, `resumeWatchBot` |
| Read/view | `getCanvasState`, `getWatchBotStatus`, `fullscreenFrame` |

Locked rules:

- `moveCard`, `resizeCard`, and `updateCanvasViewport` are **first-class**. Do not fold them into `updateCard`.
- `ownerId` is **server-derived from the session**. It must **not** appear on action inputs. Canvas and WatchBot **records** still carry `ownerId`.
- Provenance is required on **externally discovered source Cards only**. Notes do not get a fake source URL. `moveCard` / `resizeCard` do not re-require provenance.
- `setCardFrame` applies membership from spatial containment. Overlapping Frames: **smallest containing Frame wins**.
- `fullscreenFrame` is **view-only**. It must not rewrite stored Frame or Card geometry.
- Zoom / `updateCanvasViewport` is **camera-only**. No semantic zoom.
- WatchBot status: **`running` \| `paused` \| `error`** only.

WebMCP later registers the same names via `document.modelContext.registerTool({ name, description, inputSchema, execute })`.

## Data ownership sketch (not applied)

No production database. No migrations to run. Shapes live in `packages/domain/src/schema.ts`.

- **Canvas** — `owner_id`, name, persisted viewport (x, y, zoom)
- **Card** — canvas, optional `frame_id`, type, geometry, optional provenance columns
- **Frame** — canvas, name, stored bounds (fullscreen does not rewrite these)
- **WatchBot** — `owner_id`, canvas, **instruction**, status `running|paused|error`
- **WatchBotEvent** — discovery/dedup/novelty records

## Planned infrastructure (not provisioned)

Recorded only. Do not create projects or services in this phase.

| Platform | Region | Role |
| --- | --- | --- |
| **Supabase** | North Virginia, **us-east-1** | Database, Auth, Storage |
| **Railway** | **US East / Virginia** | `apps/web` runtime + `apps/worker` WatchBot worker |

## Observability (not wired)

| System | Role |
| --- | --- |
| **Sentry** | Errors, crashes, performance, worker failures |
| **PostHog** | Product analytics, funnels, retention, feature flags, session behavior, AI/LLM cost analytics |
| **Resend** | Transactional email; future WatchBot alerts/digests |

Event taxonomy: [`docs/ANALYTICS.md`](./docs/ANALYTICS.md). No secrets, instructions, article/social bodies, source HTML, or untrusted payloads.

## Non-goals (this phase)

No Canvas UI, WatchBot pipeline, WebMCP tools, billing/Stripe, xAI/Grok API wiring, production Supabase, Railway services, or deploy. Do not modify `OmarKaranib/OpenBento`.
