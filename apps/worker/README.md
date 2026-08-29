# `apps/worker`

WatchBot worker (v0 first slice).

Runs `discover → normalize → dedup → novelty → relevance → provenance → Card`
through `@openbento/watchbot` and `@openbento/domain` `createActionExecutor`.
Paused bots skip discovery. Unexpected failures set status `error` + `lastError`
without crashing the process.

```bash
pnpm --filter worker start
```

Default start seeds an in-memory fixture and runs **one cycle**. No hosted
database, no secrets, no network. Optional `--provider=grok` uses the env-gated
adapter when `XAI_API_KEY` is set.

Do not apply Supabase migrations from this app.
