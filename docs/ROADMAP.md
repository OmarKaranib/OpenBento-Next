# Execution roadmap (Issue #1)

**Phase 0 checkpoint (in progress, assigned by Omar):** PR https://github.com/OmarKaranib/OpenBento-Next/pull/2. Validation: `pnpm lint` pass; `pnpm typecheck` pass; `pnpm test` pass (12); `pnpm --filter web build` pass. Agent cannot merge and cannot write GitHub issue #1 (403). Paste this file into #1 after merge permissions allow.

This is the **single living roadmap** for OpenBento-Next. Canonical product context: [`docs/OPENBENTO_MASTER_CONTEXT.md`](https://github.com/OmarKaranib/OpenBento-Next/blob/main/docs/OPENBENTO_MASTER_CONTEXT.md).

Do not spawn a swarm of extra issues. Track work here and in PRs.

**Repo:** https://github.com/OmarKaranib/OpenBento-Next  
**Legacy (do not modify):** https://github.com/OmarKaranib/OpenBento  
**Phase 0 PR:** https://github.com/OmarKaranib/OpenBento-Next/pull/2

---

## Locked contracts

Shared domain catalog in `@openbento/domain` (20 actions — **not** a 5-action stub):

| Group | Actions |
| --- | --- |
| Canvas | `createCanvas`, `renameCanvas`, `switchCanvas`, `updateCanvasViewport` |
| Card | `createCard`, `updateCard`, `moveCard`, `resizeCard`, `setCardFrame` |
| Frame | `createFrame`, `updateFrame`, `moveFrame`, `resizeFrame` |
| WatchBot | `createWatchBot` (**requires `instruction`**), `updateWatchBot`, `pauseWatchBot`, `resumeWatchBot` |
| Read/view | `getCanvasState`, `getWatchBotStatus`, `fullscreenFrame` (view-only; must not rewrite stored geometry) |

- `moveCard`, `resizeCard`, `updateCanvasViewport` are first-class.
- `ownerId` is **server-derived from session**. Never on action inputs. Canvas and WatchBot records still carry `ownerId`.
- Provenance required on externally discovered **source Cards only**. Notes do not get a fake source URL. `moveCard`/`resizeCard` do not re-require provenance.
- Overlapping Frames: smallest area wins `setCardFrame`; equal-area ties use newest `createdAt`.
- WatchBot status: **`running` \| `paused` \| `error`** only.
- Zoom is camera-only. No semantic zoom.

## Planned infra (not provisioned)

- **Supabase** — North Virginia, us-east-1 — database, auth, storage. No project yet.
- **Railway** — US East / Virginia — web + WatchBot worker. No services yet.

## Observability (docs only, not wired)

- **Sentry** — errors, crashes, performance, worker failures
- **PostHog** — product analytics, funnels, retention, feature flags, session behavior, AI/LLM cost analytics
- **Resend** — transactional email; future WatchBot alerts/digests
- Taxonomy: `docs/ANALYTICS.md` — no secrets, instructions, article/social bodies, source HTML, or untrusted payloads. Cost metadata allowed (`provider`, `units`, `watchBotId`, `duration`).

---

## Phase 0 — Foundation — IN PROGRESS

Omar assigned. PR #2. Do not merge until owner validation.

- [x] Fresh public MIT repo
- [x] Master context on `main`
- [x] Full domain catalog (20 actions) + provenance/containment helpers + tests
- [x] Workspace `lint` / `typecheck` / `test` / `web build`
- [x] Specs rewritten from master context
- [x] Infra + observability recorded in docs
- [ ] Owner merge to `main` after validation

**Out of scope:** Canvas UI, WatchBot pipeline, WebMCP tools, billing, Grok wiring, production Supabase, Railway services, deploy.

---

## Phase 1 — Canvas foundation

**Canvas Engineer**

- [ ] Railway-inspired app shell (left rail, top context, Agent placeholder)
- [ ] Current-Canvas WatchBot status placeholder (`running`/`paused`/`error`)
- [ ] XYFlow dark dotted canvas (no semantic zoom, no graph edges)
- [ ] Multi-Canvas create/switch/rename via catalog
- [ ] Note Card; drag/resize via `moveCard`/`resizeCard`
- [ ] Bottom-left Railway-style controls
- [ ] Frame tool; move/resize/name
- [ ] Geometric membership → `setCardFrame` (smallest containing Frame)
- [ ] `fullscreenFrame` view-only (no geometry rewrite)

**Platform Engineer**

- [x] Session-derived `ownerId` (never client-supplied) — `ActionExecutor` + web wrappers
- [x] Domain action server boundary for the catalog (`createActionExecutor` / `runDomainAction`)
- [x] Persist Canvas / Card / Frame / WatchBot / WatchBotEvent / viewport behind `DomainStore` (`SupabaseDomainStore` at runtime)
- [x] Same-canvas checks before `setCardFrame` (`assertSameCanvasMembership`)
- [x] Local/dev RLS owner-scoped via `auth.uid()` (not applied to production)
- [ ] No production Supabase/Railway without approval

---

## Phase 2 — Platform Auth

**Platform Engineer** — branch `bot/platform-auth`. Do not merge without Bento Lead / owner review.

- [x] Canvas mutations through `runBoundAction` / `runDomainAction` (no browser executor with a baked-in owner)
- [x] Per-request identity from cookies/headers (no `configureAuthSession` process singleton)
- [x] Reject client-supplied `ownerId` on the UI/server path; unauthenticated requests fail
- [x] Hosted Supabase Auth `getUser()` / `auth.uid()` (unsigned `ob_local_session` is not the live path)
- [x] `SupabaseDomainStore` via `getDomainStore()` for UI/WebMCP (user JWT); worker uses `createWorkerDomainStore()`

---

## Phase 3 — Durable persist

**Platform Engineer** — branch `bot/platform-persist`. Draft PR. Do not merge without Bento Lead / owner review.

- [x] `SupabaseDomainStore` implements `DomainStore`
- [x] `getDomainStore()` is the user-JWT store for UI/WebMCP/`runBoundAction` (no InMemory runtime fallback; worker uses `createWorkerDomainStore()`)
- [x] Hosted Supabase Auth; `requireOwnerIdFromRequest` uses `auth.uid()`
- [x] Persist Canvas, Card, Frame, WatchBot, WatchBotEvent, viewport
- [x] RLS owner isolation; `assertSameCanvasMembership` still required
- [x] Unique `(watch_bot_id, dedup_key)`
- [x] Same-canvas composite FK on `watch_bot_events.card_id`
- [x] Leftover-Card TOCTOU transaction
- [x] Two-call membership; `listWatchBots` off catalog
- [x] Reload/login restore required for PASS

## Later phases (master context §17)

2. Source Cards · 3. Platform hardening (RLS) · **4. WatchBot v0 first slice (this PR: web/news worker + shared-action pipeline)** · 5. WatchBot management · 6. Agent + WebMCP · 7. Hackathon polish · 8. Commercialization after challenge

### Phase 4 — WatchBot v0 (in progress on `bot/watchbot`)

- [x] Provider-agnostic `SourceProvider` + fake provider for tests
- [x] Pipeline: discover → normalize → dedup → novelty → relevance → provenance → Card
- [x] Cards via `createActionExecutor` (`createCard` then `setCardFrame`)
- [x] `UNIQUE (watchBotId, dedupKey)` conflict → duplicate, no overwrite
- [x] Worker cycle: pause skips discovery; errors set `error` + `lastError`
- [x] Optional Grok adapter behind env (unused in default tests)
- [ ] X discovery
- [ ] YouTube discovery
- [ ] Adaptive cadence / production worker hosting
- [x] Gate 3 hosting/Auth/runtime **prepared** (`docs/DEPLOY.md`, worker fail-closed). Do not deploy or enable the worker in this slice.

---

## Standing rules

No production deploy/Supabase/Railway/DNS/spend/merge without approval. No legacy repo edits. Shared catalog only. Integration review before `main`.
