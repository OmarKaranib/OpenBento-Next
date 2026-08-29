# `@openbento/watchbot`

WatchBot **runtime stub**. Types and this README only. No observer loop, no provider calls, no pipeline.

A WatchBot is a live observer/actor **bound to one Canvas**. It must mutate the world only through `@openbento/domain` actions (`createWatchBot`, `pauseWatchBot`, `createCard`, `updateCard`, `setCardFrame`). Status is shown top-left next to the current Canvas name.

## Lifecycle (stub)

`idle` → `watching` → `acting` | `paused` | `error`

`pauseWatchBot` moves a bot to `paused`.

## SourceProvider (not wired into the domain)

Providers are **adapter-side**. The domain does not import or depend on any vendor.

- Interface: `SourceProvider` in `src/provider.ts`
- First adapter (planned, not implemented): **xAI / Grok**
- First slice sources: **web** and **news** only
- YouTube and X come after web is honest

## Pipeline (document only — implement later in `apps/worker`)

`discover → normalize → dedup → novelty → relevance → provenance → Card`

Dedup and novelty use `WatchBotEvent` / discovery records from `@openbento/domain`. Cards are written only via `createCard` / `updateCard` with required provenance.

WatchBot Engineer work lands in `apps/worker` on a branch **after** the scaffold merges. No invented schema. No merge to `main` without Bento Lead review.
