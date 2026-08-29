# WATCHBOT_SPEC — OpenBento-Next

Canonical: [`docs/OPENBENTO_MASTER_CONTEXT.md`](./docs/OPENBENTO_MASTER_CONTEXT.md) §3.4, §4, §11.

Status: **Phase 0**. Contract only. No pipeline, no provider calls.

## What a WatchBot is

A persistent **background monitoring agent** bound to a Canvas. Not the interactive Agent.

Status (locked): **`running` | `paused` | `error`**. Shown near the current Canvas name.

`createWatchBot` **requires `instruction`** (what to follow). `ownerId` is session-derived and is not an action input.

## Shared actions

| Action | Notes |
| --- | --- |
| `createWatchBot` | `canvasId` + required `instruction` |
| `updateWatchBot` | Instruction / name / sources |
| `pauseWatchBot` | → `paused` |
| `resumeWatchBot` | → `running` |
| `getWatchBotStatus` | Read status |
| `createCard` / `updateCard` | `type` + typed payload; source types require provenance |
| `setCardFrame` | Membership if a discovery is placed in a Frame |

Source Cards require provenance. Notes do not. WatchBot must not invent fake source URLs for notes.

## Pipeline (later, `apps/worker`)

`discover → normalize → dedup → novelty → relevance → provenance → Card`

Prefer meaningful developments over volume. Dedup/novelty use `WatchBotEvent` records.

`SourceProvider` is provider-agnostic. First adapter may be xAI/Grok and is **not** part of `@openbento/domain`.

Initial sources (master context): web/news, then X, then YouTube. Supported APIs only; no unrestricted scraping.

## Non-goals this phase

No worker loop, no Grok client, no SQL, no secrets.
