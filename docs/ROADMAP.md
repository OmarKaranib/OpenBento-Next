# Execution roadmap (Issue #1)

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
- Overlapping Frames: **smallest containing Frame wins** `setCardFrame`.
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

- [ ] Session-derived `ownerId` (never client-supplied)
- [ ] Domain action server boundary / APIs for the catalog
- [ ] Persist Canvas / Card / Frame / viewport (local/dev only until approved)
- [ ] Same-canvas checks before `setCardFrame`
- [ ] No production Supabase/Railway without approval

---

## Later phases (master context §17)

2. Source Cards · 3. Platform hardening (RLS) · 4. WatchBot v0 · 5. WatchBot management · 6. Agent + WebMCP · 7. Hackathon polish · 8. Commercialization after challenge

---

## Standing rules

No production deploy/Supabase/Railway/DNS/spend/merge without approval. No legacy repo edits. Shared catalog only. Integration review before `main`.
