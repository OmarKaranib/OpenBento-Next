# DECISIONS — OpenBento-Next

Binding decisions. Canonical narrative: [`docs/OPENBENTO_MASTER_CONTEXT.md`](./docs/OPENBENTO_MASTER_CONTEXT.md) §23.

The 5-action stub (`createWatchBot`, `pauseWatchBot`, `createCard`, `updateCard`, `setCardFrame` only) is **not** the locked catalog and must not land on `main`.

---

## D-001 — Fresh repo; legacy frozen

Rebuild in `OmarKaranib/OpenBento-Next`. Do not modify `OmarKaranib/OpenBento`. Do not port the 12-column dashboard.

## D-002 — Next.js 16 + pnpm workspaces

TypeScript monorepo. `apps/web` is Next.js 16 App Router. Root `packageManager` is pnpm.

## D-003 — `@xyflow/react` later

Declared on `apps/web`. `CanvasRoot.tsx` is not mounted. No graph edges by default.

## D-004 — Zoom is camera-only

`updateCanvasViewport` persists camera (x, y, zoom). No semantic zoom. Zoom does not change IA or membership.

## D-005 — Railway-like chrome

Left rail: Canvases, WatchBots, Settings; Profile fixed at the bottom. Top-left: Canvas + WatchBot status. Top-right: Agent. Bottom-left vertical toolbar. Dark dotted canvas.

## D-006 — Frames + fullscreen

Frames are persisted bordered regions. Fullscreen is **view-only** (`fullscreenFrame`) and must **not** rewrite stored Frame or Card geometry.

## D-007 — Full shared domain catalog

One catalog in `packages/domain` (20 actions):

- Canvas: `createCanvas`, `renameCanvas`, `switchCanvas`, `updateCanvasViewport`
- Card: `createCard`, `updateCard`, `moveCard`, `resizeCard`, `setCardFrame`
- Frame: `createFrame`, `updateFrame`, `moveFrame`, `resizeFrame`
- WatchBot: `createWatchBot` (requires `instruction`), `updateWatchBot`, `pauseWatchBot`, `resumeWatchBot`
- Read/view: `getCanvasState`, `getWatchBotStatus`, `fullscreenFrame`

`moveCard`, `resizeCard`, `updateCanvasViewport` are first-class. WebMCP tools use the Issue #1 snake_case → camelCase map only (`WEBMCP_SPEC.md`).

## D-008 — MIT for WebMCP detectability

Keep MIT `LICENSE` at repo root.

## D-009 — No production infra this phase

No deploy, no production Supabase project, no Railway services, no applied migrations, no merge without owner validation.

## D-010 — Card is type plus typed payload

A Card is a discriminated `type` + matching `payload`, not title/body:

`{ [K in CardType]: { type: K; payload: CardPayloadByType[K] } }[CardType]`

Externally discovered source types require `payload.provenance`. Notes are `{ text }` and must not include a fake source URL. `moveCard` / `resizeCard` do not re-require provenance.

Runtime validation is shared `PAYLOAD_SCHEMAS` in `@openbento/domain`. The catalog `inputSchema`, `isValidCardPayload`, Platform server, WatchBot, and WebMCP must use those schemas — they must not invent separate payload shapes.

## D-011 — Local/dev schema SQL

Rows: Canvas, Card, Frame, WatchBot, WatchBotEvent. SQL lives in `supabase/migrations` and matches `packages/domain/src/schema.ts`. Cards use `type` + `jsonb payload` (not title/body). Local/dev only — do not apply to a hosted/production database. No invented extra tables.

## D-012 — WatchBot as OpenBento primitive

Status: `running` | `paused` | `error`. `instruction` required on create. Provider-agnostic `SourceProvider`; optional Grok adapter is env-gated and is not imported by domain. First slice sources are web/news only.

## D-013 — `setCardFrame` from spatial containment

Membership is derived from geometry and applied through `setCardFrame`. Smallest area wins. Equal-area ties use newest `createdAt` (deterministic; array order must not decide). UI must not invent a private membership field.

Platform must call `canSetCardFrame` / `assertSameCanvasMembership` before writing membership. That helper rejects cross-canvas Card/Frame pairs and a non-null `frameId` without a loaded Frame. **RLS is not a substitute** for this domain check.

## D-014 — ownerId is server-derived

`ownerId` must not appear on action inputs. Derive from authenticated session. Canvas and WatchBot records still store `ownerId`.

## D-015 — Planned regions (not provisioned)

- **Supabase:** North Virginia, **us-east-1** — database, auth, storage. Hosted **dev** project exists (org `openbento`). Platform applies reviewed migrations. Not production.
- **Railway:** **US East / Virginia** — web runtime + WatchBot worker. No services yet.

## D-016 — Observability (not wired)

- **Sentry** — errors, crashes, performance, worker failures
- **PostHog** — product analytics, funnels, retention, feature flags, session behavior, AI/LLM cost analytics
- **Resend** — transactional email; future WatchBot alerts/digests

Taxonomy: [`docs/ANALYTICS.md`](./docs/ANALYTICS.md). No secrets, instructions, bodies, source HTML, or untrusted payloads. Cost metadata allowed (`provider`, `units`, `watchBotId`, `durationMs`).

## D-017 — Persistence port + shared executor

Handlers for `ACTION_CATALOG` live in `@openbento/domain` (`ActionExecutor`). Persistence is a `DomainStore` port. Runtime `getDomainStore()` is `SupabaseDomainStore` for UI, WebMCP, and the worker. Tests may use `InMemoryDomainStore`. Do not hard-wire Grok or any provider into the domain.

Next.js server-action wrappers in `apps/web/src/server` resolve the session user from Supabase Auth `getUser()` / `auth.uid()` and call the executor. They never take `ownerId` from the client payload. The unsigned `ob_local_session` cookie is not the live path. Do not use a process-wide owner port. Reload/login restore is required for PASS.

## D-018 — RLS is owner-scoped; membership is still a domain check

Local/dev RLS policies scope Canvas/Card/Frame/WatchBot access via `auth.uid()` (cards/frames join through canvas ownership). Never trust a client-supplied user id. `setCardFrame` still calls `assertSameCanvasMembership`. RLS is not a substitute.

## D-019 — Auth identity is request-scoped

`configureAuthSession` as a process singleton is forbidden. `runBoundAction` waits for a per-request owner from Supabase Auth `getUser()` / `auth.uid()`. Hosted Auth is the live path. Do not create a production project for this phase.
