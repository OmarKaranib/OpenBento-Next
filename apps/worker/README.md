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
pnpm --filter worker start:fixture  # isolated InMemory fixture (tests only)
```

`start` and `start:loop` never pass `--fixture`. They use the service-role
durable store and require `SUPABASE_SERVICE_ROLE_KEY` (never `NEXT_PUBLIC_`).
`--fixture` / `start:fixture` seed an in-memory store for isolated tests only.
That is not a production/runtime fallback. Optional `--provider=grok` uses the
env-gated adapter when `XAI_API_KEY` is set. Optional `--provider=x` uses the
read-only official X API v2 adapter only when `X_PROVIDER_ENABLED=true` and
`X_BEARER_TOKEN` is set; it never makes X mutations.

Do not apply Supabase migrations from this app.
