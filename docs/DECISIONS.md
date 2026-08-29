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

`moveCard`, `resizeCard`, `updateCanvasViewport` are first-class. WebMCP maps 1:1.

## D-008 — MIT for WebMCP detectability

Keep MIT `LICENSE` at repo root.

## D-009 — No production infra this phase

No deploy, no production Supabase project, no Railway services, no applied migrations, no merge without owner validation.

## D-010 — Provenance on source Cards only

Externally discovered source Cards require provenance. Notes do not get a fake source URL. `moveCard` / `resizeCard` do not re-require provenance.

## D-011 — Local schema sketch

Proposed rows: Canvas, Card, Frame, WatchBot, WatchBotEvent. Types only. No invented extra tables this phase.

## D-012 — WatchBot as OpenBento primitive

Status: `running` | `paused` | `error`. `instruction` required on create. Provider-agnostic `SourceProvider`; Grok is a planned adapter, not domain.

## D-013 — `setCardFrame` from spatial containment

Membership is derived from geometry and applied through `setCardFrame`. Overlapping Frames: **smallest containing Frame wins**. UI must not invent a private membership field.

## D-014 — ownerId is server-derived

`ownerId` must not appear on action inputs. Derive from authenticated session. Canvas and WatchBot records still store `ownerId`.

## D-015 — Planned regions (not provisioned)

- **Supabase:** North Virginia, **us-east-1** — database, auth, storage. No project yet.
- **Railway:** **US East / Virginia** — web runtime + WatchBot worker. No services yet.

## D-016 — Observability (not wired)

- **Sentry** — errors, crashes, performance, worker failures
- **PostHog** — product analytics, funnels, retention, feature flags, session behavior, AI/LLM cost analytics
- **Resend** — transactional email; future WatchBot alerts/digests

Taxonomy: [`docs/ANALYTICS.md`](./docs/ANALYTICS.md). No secrets, instructions, bodies, source HTML, or untrusted payloads. Cost metadata allowed (`provider`, `units`, `watchBotId`, `durationMs`).
