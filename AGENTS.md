# OpenBento Next project context

Consult the relevant sections of `docs/OPENBENTO_MASTER_CONTEXT.md` for product decisions or unfamiliar architecture. Its original bot-team plan is historical context; it does not require universal onboarding or a named review team.

- Preserve the spatial Canvas product rather than copying the legacy 12-column dashboard. Work in this repository; changing `OmarKaranib/OpenBento` requires a separate task.
- Human UI, WatchBot, and WebMCP share `@openbento/domain` through `createActionExecutor`. Use this branch's `ACTION_NAMES` and schemas; do not create a parallel catalog.
- Derive `ownerId` on the server. Enforce ownership and same-Canvas membership, including `canSetCardFrame` / `assertSameCanvasMembership`.
- Keep Cards as matching `type` + `payload` using `PAYLOAD_SCHEMAS`. Source Cards carry genuine provenance; notes have no invented URL.
- Preserve `createWatchBot.instruction`, WatchBot states `running | paused | error`, and existing movement, resize, and viewport actions.
- Keep Frame assignment deterministic: smallest area, then newest `createdAt` for equal areas. Fullscreen and zoom are view-only; they do not rewrite geometry or introduce semantic zoom.
- Keep destructive actions human-UI-only unless separately authorized.
- Preserve Sentry's service-scoped configuration, default PII exclusion, and exclusion of runtime auth tokens. Adding broad tracking, PostHog, or Resend changes product/privacy scope and needs an owner decision.
- Preserve unrelated work and use validation relevant to the affected behavior.
- Deployments, hosted database migrations, infrastructure/DNS changes, external spending, and merges must stay within the user's authorization. Local migration files do not authorize applying them to a hosted database.
