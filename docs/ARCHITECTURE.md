# ARCHITECTURE — OpenBento-Next

Canonical product context: [`docs/OPENBENTO_MASTER_CONTEXT.md`](./docs/OPENBENTO_MASTER_CONTEXT.md).

Status: **Phase 2 Platform Auth** on `main` (`e1959e4`), plus isolated WebMCP `registerTool` on the same executor. Canvas mutations go through `runDomainAction` / `runBoundAction`. Owner identity is request-scoped (cookies/headers), not a process-wide port. Human UI, WatchBot, and WebMCP share `createActionExecutor` and `getDomainStore()`. No second web store. No production infra.

## Monorepo

pnpm workspaces + TypeScript. Next.js 16 + React in `apps/web`.

```
apps/web              Next.js 16 App Router. Phase 1 Railway-inspired workspace.
                      CanvasRoot mounts @xyflow/react (no edges / minimap).
apps/worker           WatchBot worker. In-memory fixture cycle; pause skips discovery.
packages/domain       Catalog + handlers (`ActionExecutor`) + `DomainStore` port.
packages/watchbot     SourceProvider + pipeline. Optional Grok adapter behind env.
packages/ui           Shared visual tokens for the workspace chrome.
supabase/migrations   Local/dev SQL + RLS matching schema.ts. Do not apply to production.
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
- A Card is **discriminated `type` + matching `payload`**. `Card` / `CreateCardInput` / `UpdateCardInput` use `{ [K in CardType]: { type: K; payload: CardPayloadByType[K] } }[CardType]`. Runtime validation uses shared `PAYLOAD_SCHEMAS` (catalog, `isValidCardPayload`, future server/WebMCP). Source payloads require provenance; notes must not include it.
- `setCardFrame` applies membership from spatial containment. Smallest area wins; **equal-area ties use newest `createdAt`**. Array order must not decide ties. Platform must call `canSetCardFrame` / `assertSameCanvasMembership` before persisting membership — **do not rely on RLS alone**. Same-canvas is required; `frameId` non-null requires a loaded Frame.
- `fullscreenFrame` is **view-only**. It must not rewrite stored Frame or Card geometry.
- Zoom / `updateCanvasViewport` is **camera-only**. No semantic zoom.
- WatchBot status: **`running` \| `paused` \| `error`** only.

WebMCP registers the Issue #1 snake_case map via `document.modelContext.registerTool({ name, description, inputSchema, execute })`. `execute` is `runWebMcpTool` → `runBoundAction({ getOwnerId: requireOwnerIdFromRequest, store: getDomainStore() })`. `createActionExecutor` runs inside that path. ownerId is never taken from tool arguments.

## Shared executor

`createActionExecutor({ store, ownerId })` implements every `ACTION_CATALOG` name. `ownerId` is resolved **per request** from session cookies/headers (`requireOwnerIdFromRequest`) and bound by `runBoundAction` / `runDomainAction`. There is no process-wide `configureAuthSession` owner. Persistence is injected (`InMemoryDomainStore` for local/dev; later local Supabase can implement `DomainStore`). The Canvas `WorkspaceSession` is a UI facade that calls those server wrappers — it must not construct an executor with a baked-in owner id and must not add a second store in `apps/web`.

## Data ownership (local/dev SQL)

SQL is in `supabase/migrations`. **Do not apply to production. Do not create a hosted Supabase project from this work.** Shapes live in `packages/domain/src/schema.ts`.

- **Canvas** — `owner_id`, name, persisted viewport (x, y, zoom)
- **Card** — canvas, optional `frame_id`, type, `jsonb` payload (not title/body)
- **Frame** — canvas, name, stored bounds (fullscreen does not rewrite these)
- **WatchBot** — `owner_id`, canvas, **instruction**, status `running|paused|error`
- **WatchBotEvent** — discovery/dedup/novelty records

RLS: every table is owner-scoped via `auth.uid()` (cards/frames join through canvas ownership). Handlers still call `assertSameCanvasMembership`. RLS is not a substitute. Never trust a client-supplied user id.

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

No X/YouTube discovery, billing/Stripe, production Supabase, Railway services, or deploy. Isolated WebMCP `registerTool` is on this branch. Do not modify `OmarKaranib/OpenBento`. Do not apply migrations to any hosted database. The Canvas UI must not reimplement `InMemoryDomainStore`. WebMCP must not mint a second session owner. Domain must not import Grok/xAI.
