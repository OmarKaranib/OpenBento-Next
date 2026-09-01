# `apps/worker`

WatchBot worker (v0 first slice).

Runs `discover → normalize → dedup → novelty → relevance → provenance → Card`
through `@openbento/watchbot` and `@openbento/domain` `createActionExecutor`.
Paused bots skip discovery. Unexpected failures set status `error` + `lastError`
without crashing the process.

Runtime persist is `createWorkerDomainStore()` (explicit service-role factory).
It must not use web `getDomainStore()`, which is user-JWT only. The worker
stamps `ownerId` from the WatchBot record.
`listWatchBots` is a store scan, not an `ACTION_CATALOG` action.

```bash
pnpm --filter worker start          # one durable cycle (createWorkerDomainStore)
pnpm --filter worker start:loop     # durable loop
pnpm --filter worker start:loop -- --provider=x   # Railway-intended X adapter path
pnpm --filter worker start:fixture  # isolated InMemory fixture (tests only)
```

**Status:** worker implementation is ready in-repo. Railway worker **deployment
is not yet authorized**. Live X has **not** been verified. See `docs/DEPLOY.md`.

Hosted/runtime start is fail-closed: `OPENBENTO_WORKER_ENABLED` must be `true`
or `1`. Absent or `false` logs `openbento_worker_disabled` and does not
construct a service-role client, provider, or run cycles; `--loop` exits
cleanly. Optional `OPENBENTO_WORKER_INTERVAL_MS` is capped at 300000.

### One-shot env gate (`OPENBENTO_WORKER_RUN_ONCE`)

When `OPENBENTO_WORKER_ENABLED=true` and `OPENBENTO_WORKER_RUN_ONCE=true`
(or `1`), the worker runs **exactly one** tick and exits — even if argv
includes `--loop` (including the canonical Railway start command). Logs
`openbento_worker_run_once`. This gate does **not** bypass worker or X
fail-closed gates.

Use this for controlled live tests instead of overriding the Railway start
command in the dashboard.

### Global X request budget (`X_MAX_REQUESTS_PER_WORKER_TICK`)

Default `1`, hard ceiling `10`. Shared across all X-eligible WatchBots in
one worker tick. Once exhausted, later X WatchBots are skipped cleanly
(`x_budget_exhausted`) — not marked as errors. Per-WatchBot caps
(`X_MAX_REQUESTS_PER_CYCLE`, etc.) remain in force.

Effective safety: global worker-tick budget **and** per-WatchBot adapter caps.

### Tick telemetry

Each tick emits JSON with aggregate pipeline counters, for example:
`watchBotsLoaded`, `watchBotsProcessed`, `providerEligibleWatchBots`,
`discovered`, `normalized`, `novel`, `duplicates`, `rejectedRelevance`,
`cardsCreated`, `errors`, `xHttpRequests`, `durationMs`, `runMode`
(`once` | `loop`), and optional per-WatchBot summaries. Never logs bearer
tokens, service-role keys, owner IDs, instructions, or full tweet bodies.

`railway.worker.toml` starts:
`pnpm --filter worker start:loop -- --provider=x`
so `process.argv` includes `--provider=x` (X adapter selected). That does **not**
enable X: `X_PROVIDER_ENABLED` defaults to `false`, and the global worker gate
defaults to `false`.

### Safe future live-test sequence

1. `OPENBENTO_WORKER_ENABLED=false`
2. `X_PROVIDER_ENABLED=false`
3. `OPENBENTO_WORKER_RUN_ONCE=true`
4. `X_MAX_REQUESTS_PER_WORKER_TICK=1`
5. Enable worker + X
6. Deploy/redeploy (loop start command unchanged)
7. Observe exactly one tick
8. Return worker=false / X=false
9. `OPENBENTO_WORKER_RUN_ONCE=false`

`start` and `start:loop` never pass `--fixture`. They use the service-role
durable store and require `SUPABASE_SERVICE_ROLE_KEY` (never committed; never
on the web service) when enabled. `--fixture` / `start:fixture` seed an
in-memory store for isolated tests only. That is not a production/runtime
fallback. Optional `--provider=grok` uses the env-gated adapter when
`XAI_API_KEY` is set. `--provider=x` uses the read-only official X API v2
adapter only when the global worker is enabled, `X_PROVIDER_ENABLED=true`, and
the worker-only `X_BEARER_TOKEN` is set. The X lane has separate
query/request/page/result/timeout caps and never makes X mutations.

Do not apply Supabase migrations from this app.
