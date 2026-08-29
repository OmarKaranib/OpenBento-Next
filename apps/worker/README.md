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
pnpm --filter worker start          # isolated --fixture cycle (tests / local demo)
```

`--fixture` seeds an in-memory store for isolated tests only. It is not a
production/runtime fallback. Optional `--provider=grok` uses the env-gated
adapter when `XAI_API_KEY` is set.

Do not apply Supabase migrations from this app.
