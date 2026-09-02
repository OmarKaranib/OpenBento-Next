# Agent rules — OpenBento-Next

Read [`docs/OPENBENTO_MASTER_CONTEXT.md`](./docs/OPENBENTO_MASTER_CONTEXT.md) before product, architecture, UI, data, WatchBot, WebMCP, infra, or monetization decisions.

## Forbidden

- Do not modify `OmarKaranib/OpenBento`.
- Do not copy the legacy 12-column widget dashboard.
- Do not deploy, create production Supabase, provision Railway, change DNS, spend money, or merge to `main` without owner approval.
- Do not apply migrations to any hosted/production database. Local/dev SQL in `supabase/migrations` is not authorization to push.
- Do not land a 5-action stub as the locked catalog.

## Shared domain catalog (mandatory)

Human UI, WatchBot, and WebMCP use `@openbento/domain` (`ACTION_NAMES`, 20 actions) via `createActionExecutor`. Do not invent a second catalog.

- `ownerId` is server-derived. Never put it on action inputs.
- `createWatchBot` requires `instruction`.
- `moveCard` / `resizeCard` / `updateCanvasViewport` are first-class.
- Provenance on source Cards only; notes have no fake URL.
- A Card is a discriminated `type` + matching `payload` (`PAYLOAD_SCHEMAS` shared by UI, server, WatchBot, WebMCP).
- `setCardFrame`: smallest area wins; equal-area ties use newest `createdAt`. Platform uses `canSetCardFrame` / `assertSameCanvasMembership` (not RLS alone).
- `fullscreenFrame` is view-only; no geometry rewrite.
- WatchBot status: `running` | `paused` | `error` only.
- Zoom is camera-only. No semantic zoom.

## Observability / infra

Sentry error monitoring is allowed for web and worker with service-scoped DSNs,
default PII disabled, and no auth token in runtime services. Do not add broad
analytics/product tracking or PostHog/Resend SDKs or keys. Planned: Supabase
us-east-1; Railway US East / Virginia.

## Merge bar

Bento Lead / owner integration review before `main`. QA verifies independently.
