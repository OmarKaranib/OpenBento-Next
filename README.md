# OpenBento

> **AI-native live intelligence canvas.**

OpenBento is a spatial workspace for following an evolving topic through
source-backed Cards, persistent WatchBots, and AI assistance. Create a Canvas,
place and resize Cards freely inside a canonical dashboard Frame, and return to a living
view of what matters.

> **AI organizes the story. Sources remain the story.**

**Live app:** [web-production-4d6c9e.up.railway.app](https://web-production-4d6c9e.up.railway.app)

## What judges can explore

- **Canvas, Cards, and dashboard Frame** — a Next.js 16 / React workspace on XYFlow
  with free-positioned, resizable Cards, one fixed 1600×900 Frame, and a view-only
  fullscreen Frame mode.
- **Monitoring UX** — current-Canvas search and filtering, source provenance
  links, and truthful browser-local “New since last visit” indicators.
- **WatchBots** — persistent monitoring agents with a worker-side pipeline:
  discover → normalize → deduplicate → novelty → relevance → clustering →
  meaningfulness → selection → source-backed Card creation.
- **Interactive Agent** — an authenticated, server-side OpenAI Responses
  integration that works through the shared application actions rather than a
  separate demo state.
- **WebMCP** — 13 tools let an external agent operate the same durable visual
  workspace and domain actions as the human interface.

## Implemented stack and capabilities

- Next.js 16, React, TypeScript, pnpm, and Node **22.23.2**
- Supabase Auth with durable PostgreSQL persistence and owner-scoped domain
  actions
- Railway web service plus a separately deployed WatchBot worker
- XYFlow Canvas; Cards can be moved and resized; the primary Frame uses geometric
  membership and can be fullscreened without rewriting saved layout
- Source provenance preserves truthful links and known timestamps; externally
  supplied text and URLs are treated as untrusted data
- Browser-local, per-Canvas “New since last visit” — not a server-global
  unread claim
- Interactive Agent with a dedicated web-server-only
  `OPENAI_AGENT_API_KEY`
- Official X and YouTube Data API v3 providers, plus an opt-in OpenAI web/news
  provider, for WatchBot discovery
- Meaningfulness classification defaults to `gpt-5.6-luna`; the pipeline also
  preserves bounded deduplication, novelty, relevance, clustering, and
  selection stages
- Sentry error monitoring for web and worker, inert unless its service-scoped
  DSN is configured; default PII and tracing are disabled
- MIT licensed

The worker is intentionally fail-closed outside controlled validation. Provider
gates and request budgets keep X, YouTube, web/news, and classifier activity
bounded; this repository does not claim always-on production monitoring.

## Why WebMCP matters

WebMCP makes OpenBento more than a chatbot beside a canvas. An external agent
uses the same persistent Canvas, Cards, canonical Frame, WatchBots, and shared
`ACTION_CATALOG` / domain executor as the human UI. Its changes are visible in
the same workspace, follow the same ownership rules, and retain the same Frame
membership behavior.

Implemented tools:

`get_canvas_state` · `create_canvas` · `switch_canvas` · `create_card` ·
`move_card` · `resize_card` · `fullscreen_frame` ·
`create_watchbot` · `update_watchbot` · `pause_watchbot` ·
`resume_watchbot` · `get_watchbot_status`

See [WEBMCP_SPEC.md](./WEBMCP_SPEC.md) for the exact tool map and judge setup.

## Live-validation evidence

- Hosted Interactive Agent proof: created a Note through `createCard` and a
  WatchBot through `createWatchBot` on the Canvas.
- Final OpenAI web/news proof after the relevance hotfix: **5 discovered, 5
  normalized, 4 novel, 1 correctly rejected as irrelevant, and 3 Cards
  created.**
- Final pinned Luna classifier regression: **5/5**.
- Automated baseline after PR #39: **540 tests across 62 files**.

## Trust and safety

- `ownerId` is derived from the authenticated request/session; callers,
  models, and WebMCP tools cannot supply it.
- The browser never receives worker/provider/service-role secrets.
- `OPENAI_AGENT_API_KEY` is web-server-only. `OPENAI_API_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, and provider credentials are worker-only.
- Source text, source URLs, and provider metadata are untrusted data, never
  application instructions. Source provenance remains attached to sourced
  Cards.
- Provider lanes are independently gated and hard-bounded. No credential
  values belong in this repository or its docs.

## Try it

### Hosted app

1. Open [the live app](https://web-production-4d6c9e.up.railway.app).
2. Sign in, create or select a Canvas, add a Note, move/resize it, and draw a
   Frame around it.
3. Inspect source provenance and use the current-Canvas monitoring controls.
4. Visit [`/webmcp`](https://web-production-4d6c9e.up.railway.app/webmcp) for
   the registered-tool reference.

### Local setup

Requires Node **22.23.2** and pnpm **10.33.3**.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

For a local authenticated app, supply only the public Supabase settings
described in `.env.example`. Do not put worker or provider credentials in a
browser-facing environment.

### WebMCP testing

1. Start the web app with `pnpm --filter web dev`.
2. Open `/` in ChatGPT’s in-app browser, or Chrome 149+ with
   `chrome://flags/#enable-webmcp-testing` enabled.
3. Authenticate, then ask the host agent to create a Canvas/Card/Frame or
   WatchBot. The Canvas registers the 13 tools when the WebMCP API is present.
4. Confirm the resulting change appears in the same persistent Canvas. Normal
   browsers continue to run OpenBento without WebMCP registration.

### Automated checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter web build
```

## AI-assisted development

OpenBento was developed with ChatGPT, OpenAI Codex, Cursor, and the Grok Build
Room / xAI-assisted development where applicable. Human owners retained review
and release authority.

## Project docs

- [Hackathon / judge guide](./HACKATHON.md)
- [WebMCP tool specification](./WEBMCP_SPEC.md)
- [Canonical product context](./docs/OPENBENTO_MASTER_CONTEXT.md)
- [Deployment and environment boundaries](./docs/DEPLOY.md)
- [MIT License](./LICENSE)

The legacy [OmarKaranib/OpenBento](https://github.com/OmarKaranib/OpenBento)
repository is frozen and was not used as the current implementation source.
