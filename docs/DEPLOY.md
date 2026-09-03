# Deploy — Gate 3 (prepare, do not activate)

Application + config for Railway web + worker against the existing
`openbento-next` Supabase dev project. Persistence already lives there.

**Status (truthful):**

| Surface | Status |
| --- | --- |
| Web service | Hosted on Railway (`web-production-4d6c9e`) |
| WatchBot worker **implementation** | Ready in-repo (`apps/worker`, X adapter, fail-closed gates) |
| WatchBot worker **deployment** | Hosted on Railway, globally disabled (`OPENBENTO_WORKER_ENABLED` fail-closed) |
| Live X verification | **Not yet verified** — no production/dev X cycle has been authorized |

This document does **not** deploy Railway, create a Railway worker service, apply production SQL, create another Supabase project, enable `OPENBENTO_WORKER_ENABLED`, enable `X_PROVIDER_ENABLED`, or call the X API. Public worker deploy and live providers remain **CR3**.

## Two Railway services (same repo)

Railway Config as Code (`railway.toml` / `railway.json`) describes **one service per file**. Create **two services** in the dashboard from this GitHub repo. Both must use **Root Directory = repo root** (`/` / empty). Do **not** set Root Directory to `apps/web` — the pnpm lockfile lives at the repo root.

Target region: **US East / Virginia**. Read-only verification on 2 September
2026 found both live services configured in Railway region `ams` instead. Moving
regions is a separate production CR3 change and is not authorized by this file.

| Service | Config file | Public domain | Healthcheck |
| --- | --- | --- | --- |
| **web** | `railway.toml` (default) | Yes (needed for Auth) | `/health` only |
| **worker** | `railway.worker.toml` | **No** | **None** — Railway healthcheck is **web-only** |

Set the worker service **Config File** path to `railway.worker.toml`. If left at the default `railway.toml`, the worker would try to start Next.js.

### Web (dashboard or `railway.toml`)

- Install: `pnpm install --frozen-lockfile`
- Build: `pnpm --filter web build`
- Start: `pnpm --filter web start` (`next start` binds `0.0.0.0` and `$PORT`)
- Healthcheck path: `/health`

### Worker (dashboard or `railway.worker.toml`) — expected shape when authorized

| Field | Value |
| --- | --- |
| Project | `OpenBento-Next` |
| New service name | `worker` |
| Source | `OmarKaranib/OpenBento-Next`, branch `main` |
| Root directory | repo root |
| Config file | `railway.worker.toml` |
| Public domain | **NONE** |
| Healthcheck | **NONE** |
| Restart | `ON_FAILURE` |
| Initial gates | `OPENBENTO_WORKER_ENABLED=false`, `X_PROVIDER_ENABLED=false` |
| Networking | No public networking |

- Install: `pnpm install --frozen-lockfile`
- Build: none (do not run the Next build)
- Start: `pnpm --filter worker start:loop -- --provider=x`
  - Selects the official X adapter path via `--provider=x` (pnpm forwards that flag into `process.argv`).
  - Does **not** enable X or the worker. Defaults stay fail-closed.
  - Without `--provider=x`, the process would fall through to `FakeSourceProvider([])` even if env later enabled X.
- No public domain

Watch paths are optional and already listed in the CaC files.

## Environment variable names (values never in git)

Names only. Set real values in the Railway dashboard (and never commit them). Do **not** retrieve or print secret values in agent sessions.

### Web

| Name | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Existing **dev** project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable / anon key. Alias: `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `NEXT_PUBLIC_SITE_URL` | Public origin for Auth redirects (hosted web origin) |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional browser error-ingestion DSN; public by design. Default PII and tracing are disabled |
| `SENTRY_DSN` | Optional web server/edge error-ingestion DSN; service-scoped |

Do **not** set `SUPABASE_SERVICE_ROLE_KEY`, `X_BEARER_TOKEN`, or
`YOUTUBE_API_KEY` on the web service.

### Worker only (exact names for a future X-only service)

| Name | Initial / notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Same **dev** project as web. Historical/shared factory input — on the worker this is used **only** to construct the Supabase client, not to expose a browser runtime |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same as web (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Same factory-input note as above |
| `SUPABASE_SERVICE_ROLE_KEY` | **Worker-only.** Never on web. Required only when the worker gate is enabled |
| `SENTRY_DSN` | Optional worker error-ingestion DSN; keep scoped to the worker service |
| `OPENBENTO_WORKER_ENABLED` | **`false`** initially. Global fail-closed gate. Absent / `false` / anything other than `true` or `1` → clean exit (`openbento_worker_disabled`), **before** store/provider construction, service-role access, X credentials, or cycles |
| `OPENBENTO_WORKER_RUN_ONCE` | **`false`** initially. When `true`/`1` with worker enabled, runs **exactly one** tick and exits — even when `railway.worker.toml` starts `--loop`. Logs `openbento_worker_run_once`. Does **not** bypass worker or X gates |
| `OPENBENTO_WORKER_INTERVAL_MS` | Optional loop interval. Default `60000`. Hard ceiling `300000` (5 minutes) |
| `X_PROVIDER_ENABLED` | **`false`** initially. Independent X-lane gate. Defaults off even when the global worker is enabled |
| `X_BEARER_TOKEN` | **Worker-only.** Never on web. Never `NEXT_PUBLIC_`. Required only when X lane is enabled |
| `X_MAX_RESULTS_PER_REQUEST` | `10` (bounded; values above code caps are clamped) |
| `X_MAX_RESULTS_PER_CYCLE` | `10` |
| `X_MAX_PAGES_PER_CYCLE` | `1` |
| `X_MAX_REQUESTS_PER_CYCLE` | `1` |
| `X_MAX_REQUESTS_PER_WORKER_TICK` | `1` (shared across all WatchBots in one tick; hard ceiling `10`) |
| `X_PROVIDER_TIMEOUT_MS` | `10000` |
| `WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED` | **`false`** initially. Independent meaning-classifier gate. Defaults off even when the global worker and X lane are enabled. Missing this gate → passthrough (no paid classifier calls) |
| `WATCHBOT_MEANINGFULNESS_PROVIDER` | **`none`** initially. Explicit selector: `openai` \| `xai` \| `none`. Missing/empty/unknown → `none` (passthrough). Never auto-picks from which API key is present |
| `OPENAI_API_KEY` | **Worker-only.** Required when the classifier gate is on **and** `WATCHBOT_MEANINGFULNESS_PROVIDER=openai`, and/or when OpenAI web/news discovery is enabled. Never on web. Never `NEXT_PUBLIC_` |
| `WATCHBOT_OPENAI_WEB_PROVIDER_ENABLED` | **`false`** initially. Independent OpenAI web/news discovery gate. Worker selects the adapter with `--provider=openai-web`. Missing gate or key → fail closed (null / composition error) |
| `YOUTUBE_PROVIDER_ENABLED` | **`false`** initially. Independent YouTube discovery gate. A key alone does not enable the provider; select it with `--provider=youtube` |
| `YOUTUBE_API_KEY` | Worker-only YouTube Data API v3 credential. Never web, browser, `NEXT_PUBLIC_*`, logs, or repository |
| `YOUTUBE_MAX_REQUESTS_PER_TICK` | Shared request cap across YouTube WatchBots. Default `2`, hard ceiling `10` |
| `YOUTUBE_MAX_RESULTS_PER_CYCLE` | Per-WatchBot YouTube result cap. Default `10`, hard ceiling `20` |
| `YOUTUBE_TIMEOUT_MS` | Request timeout. Default `10000`, hard ceiling `15000` |
| `OPENAI_WEB_MODEL` | `gpt-5.6-luna` |
| `WATCHBOT_OPENAI_WEB_MAX_REQUESTS_PER_TICK` | `1` (shared across WatchBots in one tick; hard ceiling `5`) |
| `WATCHBOT_OPENAI_WEB_MAX_REQUESTS_PER_CYCLE` | `1` (per WatchBot cycle; hard ceiling `2`) |
| `WATCHBOT_OPENAI_WEB_MAX_RESULTS_PER_CYCLE` | `10` (hard ceiling `20`) |
| `WATCHBOT_OPENAI_WEB_TIMEOUT_MS` | `15000` (ceiling `30000`) |
| `OPENAI_AGENT_API_KEY` | **Web server-only.** Interactive Agent Responses API credential. Never reuse `OPENAI_API_KEY` on web. Never `NEXT_PUBLIC_` |
| `OPENAI_AGENT_MODEL` | Web optional. Default `gpt-5.6-terra` for the Interactive Agent |
| `OPENAI_MEANINGFULNESS_MODEL` | `gpt-5.6-luna` (override to compare Luna vs Terra without domain changes) |
| `OPENAI_API_BASE_URL` | `https://api.openai.com/v1` |
| `WATCHBOT_MEANINGFULNESS_MAX_CALLS_PER_TICK` | `5` (shared across WatchBots in one tick; hard ceiling `20`) |
| `WATCHBOT_MEANINGFULNESS_MAX_CALLS_PER_CYCLE` | `5` (per WatchBot pipeline cycle; hard ceiling `10`) |
| `WATCHBOT_MEANINGFULNESS_TIMEOUT_MS` | `8000` (ceiling `15000`) |

**Secret separation:** `SUPABASE_SERVICE_ROLE_KEY`, `X_BEARER_TOKEN`, and `YOUTUBE_API_KEY` remain worker-only and must never be added to the web service or any `NEXT_PUBLIC_*` path. `XAI_API_KEY` and `OPENAI_API_KEY` are also worker-only when the classifier, Grok discovery, or OpenAI web/news adapter is used. The Interactive Agent uses a dedicated web server-only `OPENAI_AGENT_API_KEY` and must not fall back to worker `OPENAI_API_KEY`. Never log or commit these keys.

Sentry is error monitoring only: no product analytics, replay, performance
tracing, or default PII collection. Do not place `SENTRY_AUTH_TOKEN` on either
runtime service; this repository does not upload source maps. A missing DSN
leaves monitoring inert.

**Gate order (do not weaken):**

1. `OPENBENTO_WORKER_ENABLED=false` + `X_PROVIDER_ENABLED=true` → still exits before constructing provider/store (no credential use, no cycle).
2. `OPENBENTO_WORKER_ENABLED=true` + `X_PROVIDER_ENABLED=false` + `--provider=x` → may construct the X adapter object, but discover produces **zero** X API calls.
3. Both true + missing `X_BEARER_TOKEN` → fail closed (`credential_missing`) before a successful cycle.

Optional Grok (`XAI_API_KEY`) remains a separate, unused lane for this X-only readiness slice. Do not activate xAI/Grok here.

## Future single-cycle live X test (DO NOT EXECUTE YET)

Controlled sequence for a later CR3 authorization. Use env-gated one-shot — **do not** rely on Railway dashboard start-command overrides. Keep `railway.worker.toml` on the canonical loop command:

`pnpm --filter worker start:loop -- --provider=x`

Safe live-test sequence:

1. `OPENBENTO_WORKER_ENABLED=false`
2. `X_PROVIDER_ENABLED=false`
3. `OPENBENTO_WORKER_RUN_ONCE=true`
4. `X_MAX_REQUESTS_PER_WORKER_TICK=1` (plus existing per-cycle caps)
5. Enable worker + X (`OPENBENTO_WORKER_ENABLED=true`, `X_PROVIDER_ENABLED=true`)
6. Deploy/redeploy the worker service (loop start command unchanged)
7. Observe **exactly one** tick in logs (`openbento_worker_run_once`, aggregate telemetry with `runMode: "once"`, `xHttpRequests` ≤ budget)
8. Return gates off: `OPENBENTO_WORKER_ENABLED=false`, `X_PROVIDER_ENABLED=false`
9. Return `OPENBENTO_WORKER_RUN_ONCE=false`

Prerequisites before step 5:

- Create the Railway `worker` service with gates initially **OFF**
- Add worker-only Supabase credentials and `X_BEARER_TOKEN`
- Keep bounded X limits at: requests/cycle = 1, pages/cycle = 1, results/cycle = 10, results/request = 10, timeout = 10000
- Create/use **one** WatchBot whose `sourceTypes` include `"x"`

Inspect: aggregate telemetry (discovered, normalized, novel, rejectedRelevance, cardsCreated, xHttpRequests), cards/provenance, dedup, Railway logs, X credit usage.

Do **not** execute this plan from this documentation-only readiness change.

## Hosted Auth (document only)

After the Railway **web** public URL is known, set `NEXT_PUBLIC_SITE_URL` to that origin (no trailing slash), then in the existing **openbento-next** Supabase project:

1. Authentication → URL Configuration
2. **Site URL** = `{NEXT_PUBLIC_SITE_URL}`
3. **Redirect URLs** add:
   - `{NEXT_PUBLIC_SITE_URL}/**`
   - `{NEXT_PUBLIC_SITE_URL}/auth/callback`

`/auth/callback` is the existing `@supabase/ssr` PKCE code-exchange route (email confirm / recovery). It is not a second auth system.

Local Site URL may remain `http://localhost:3000` until the hosted origin is ready.

## Health

- Web `GET /health` returns **200** when the Next process is up. Body is a static `{ ok: true }` — no secrets, env, or user data.
- Railway healthcheck is **web-only**. The worker has no public domain and no healthcheck path.
- Read-only production verification on 2 September 2026 returned HTTP 200 and
  `{ "ok": true }` from the Railway web `/health` endpoint. Both latest Railway
  deployments reported `SUCCESS`; the worker log exited at
  `openbento_worker_disabled` and showed the Node 20 Supabase deprecation warning.
  The repository pins Node 22.23.2; confirm the warning disappears after a
  separately authorized deployment.

## Rollback

Redeploy each Railway service's previous successful deploy from that service's deploy history. Do not apply new SQL as part of a rollback. The worker kill switch is `OPENBENTO_WORKER_ENABLED=false` (absent/false also fail closed): the loop does not run cycles and does not construct a service-role client.

## Public security review

- No service-role key on the web service or in any `NEXT_PUBLIC_` variable. `readWebSupabaseEnv` / `getDomainStore` must not read `SUPABASE_SERVICE_ROLE_KEY`.
- No `X_BEARER_TOKEN` on the web service or in any `NEXT_PUBLIC_` path.
- Worker default off (`OPENBENTO_WORKER_ENABLED` fail closed). X lane default off (`X_PROVIDER_ENABLED` fail closed).
- No secrets in git (`.env.example` and this file list **names** only).
- `/health` is public and must stay empty of secrets, env, and user data.
- Auth Site URL / Redirect URLs are set only after the public Railway URL is known.
