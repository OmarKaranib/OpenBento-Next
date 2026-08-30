# Deploy — Gate 3 (prepare, do not activate)

Application + config so Omar can later authorize a **Railway US East** deploy of web + worker against the **existing** `openbento-next` Supabase **dev** project (us-east-1, ref `rullqomazkamlncuotqu`). Persistence already lives there.

This PR does **not** deploy Railway, create a Railway project, apply production SQL, create another Supabase project, or turn the worker on. Public deploy, hosted Auth dashboard edits, live providers, and worker activation are **CR3**.

## Two Railway services (same repo)

Railway Config as Code (`railway.toml` / `railway.json`) describes **one service per file**. Create **two services** in the dashboard from this GitHub repo. Both must use **Root Directory = repo root** (`/` / empty). Do **not** set Root Directory to `apps/web` — the pnpm lockfile lives at the repo root.

Region: **US East / Virginia**.

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

### Worker (dashboard or `railway.worker.toml`)

- Install: `pnpm install --frozen-lockfile`
- Build: none (do not run the Next build)
- Start: `pnpm --filter worker start:loop` (`createWorkerDomainStore`, not the fixture)
- No public domain

Watch paths are optional and already listed in the CaC files.

## Environment variable names (values never in git)

Names only. Set real values in the Railway dashboard (and never commit them).

### Web

| Name | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Existing **dev** project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable / anon key. Alias: `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `NEXT_PUBLIC_SITE_URL` | Public origin for Auth redirects. Placeholder until the Railway web URL exists |

Do **not** set `SUPABASE_SERVICE_ROLE_KEY` on the web service.

### Worker only (never `NEXT_PUBLIC`, never on the web runtime)

| Name | Notes |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role. Required only when the worker is enabled |
| `NEXT_PUBLIC_SUPABASE_URL` | Same **dev** project as web (store factory still needs the public URL) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same as web (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `OPENBENTO_WORKER_ENABLED` | Global fail-closed gate. Absent / `false` / anything other than `true` or `1` → clean exit, no provider/store construction, no cycles |
| `OPENBENTO_WORKER_INTERVAL_MS` | Optional. Default `60000`. Hard ceiling `300000` (5 minutes) |

### Optional providers (names only; fail closed if missing)

| Name | Notes |
| --- | --- |
| `XAI_API_KEY` | Optional Grok adapter. Do not activate for Gate 3 |
| `X_PROVIDER_ENABLED` | Independent X-lane gate. Defaults off even when the global worker is enabled |
| `X_BEARER_TOKEN` | Implemented X adapter's worker-only credential. No live DEV credential is activated or verified yet |
| `X_MAX_RESULTS_PER_REQUEST` | Bounded X results requested per call |
| `X_MAX_RESULTS_PER_CYCLE` | Bounded total X results emitted per cycle |
| `X_MAX_PAGES_PER_CYCLE` | Bounded X pagination per cycle |
| `X_MAX_REQUESTS_PER_CYCLE` | Bounded X requests per cycle |
| `X_PROVIDER_TIMEOUT_MS` | Bounded X request timeout |

Leave `OPENBENTO_WORKER_ENABLED` unset or `false` until CR3. That global gate
takes precedence over every provider gate. Live X DEV verification remains a
separate CR3 step; do not set `X_PROVIDER_ENABLED=true` or a bearer token for
this source-only preparation.

## Hosted Auth (document only — do not edit the live dashboard in this PR)

After the Railway **web** public URL is known, set `NEXT_PUBLIC_SITE_URL` to that origin (no trailing slash), then in the existing **openbento-next** Supabase project:

1. Authentication → URL Configuration
2. **Site URL** = `{NEXT_PUBLIC_SITE_URL}`
3. **Redirect URLs** add:
   - `{NEXT_PUBLIC_SITE_URL}/**`
   - `{NEXT_PUBLIC_SITE_URL}/auth/callback`

`/auth/callback` is the existing `@supabase/ssr` PKCE code-exchange route (email confirm / recovery). It is not a second auth system. Do not change the dashboard until that public URL exists.

Local Site URL may remain `http://localhost:3000` until the hosted origin is ready.

## Health

- Web `GET /health` returns **200** when the Next process is up. Body is a static `{ ok: true }` — no secrets, env, or user data.
- Railway healthcheck is **web-only**. The worker has no public domain and no healthcheck path.

## Rollback

Redeploy each Railway service's previous successful deploy from that service's deploy history. Do not apply new SQL as part of a rollback. The worker kill switch is `OPENBENTO_WORKER_ENABLED=false` (absent/false also fail closed): the loop does not run cycles and does not construct a service-role client.

## Public security review

- No service-role key on the web service or in any `NEXT_PUBLIC_` variable. `readWebSupabaseEnv` / `getDomainStore` must not read `SUPABASE_SERVICE_ROLE_KEY`.
- Worker default off (`OPENBENTO_WORKER_ENABLED` fail closed).
- No secrets in git (`.env.example` and this file list **names** only).
- `/health` is public and must stay empty of secrets, env, and user data.
- Auth Site URL / Redirect URLs are set only after the public Railway URL is known.
