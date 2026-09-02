# WATCHBOT_SPEC — OpenBento-Next

Canonical: [`docs/OPENBENTO_MASTER_CONTEXT.md`](./docs/OPENBENTO_MASTER_CONTEXT.md) §3.4, §4, §11, Phase 4.

Status: **Phase 4 v0 first slice** on `bot/watchbot`. Web/news only. No X/YouTube discovery. No production worker deploy.

## What a WatchBot is

A persistent **background monitoring agent** bound to a Canvas. Not the interactive Agent.

Status (locked): **`running` | `paused` | `error`**. Shown near the current Canvas name.

`createWatchBot` **requires `instruction`** (what to follow). `ownerId` is session-derived and is not an action input.

## Shared actions

| Action | Notes |
| --- | --- |
| `createWatchBot` | `canvasId` + required `instruction` |
| `updateWatchBot` | Instruction / name / sources |
| `pauseWatchBot` | → `paused` (worker skips discovery) |
| `resumeWatchBot` | → `running` (worker continues) |
| `getWatchBotStatus` | Read status |
| `createCard` / `updateCard` | `type` + typed payload; source types require provenance |
| `setCardFrame` | Membership after geometry — never folded into `createCard` |

Source Cards require provenance. Notes do not. WatchBot must not invent fake source URLs for notes. `provenance.publishedAt` is stored only when the discovery has a real timestamp; empty string when unknown. Do not mint `now`.

## Pipeline (`packages/watchbot` + `apps/worker`)

`discover → normalize → dedup → novelty → relevance → cluster → meaning → provenance → Card`

- `SourceProvider` is provider-agnostic. Tests inject `FakeSourceProvider`.
- First adapter may be xAI/Grok behind `XAI_API_KEY`. Domain does not import it.
- Dedup: `UNIQUE (watchBotId, dedupKey)` is claimed on `card_created` only, after `createCard` and `setCardFrame` succeed. Conflict → `duplicate`, no overwrite, no Card. A thrown `createCard` does not occupy the key. Rejected / low-novelty identity events use staged keys so they do not block a later honest Card of the same URL.
- Membership: `createCard` (bounds only) then `selectSmallestContainingFrame` → `setCardFrame`.
- Event kinds: `discovered`, `normalized`, `duplicate`, `novel`, `rejected_relevance`, `card_created`, `error`.
- First slice sources: **web and news only**.
- Prefer meaningful developments over volume (novelty + relevance + cluster + optional meaning classifier + cap).
- Slice C meaning/importance is a provider-independent contract in `@openbento/watchbot`. Default is passthrough (no model call). Low-meaningful representatives are excludable before Card creation when a classifier is present. No ASCII/English lexical gates.
- Slice D optional xAI/Grok adapter (`adapters/meaningfulness-classifier.ts`) remains. Slice E adds an OpenAI Responses adapter (`adapters/openai-meaningfulness-classifier.ts`, default `gpt-5.6-luna`) plus `createConfiguredMeaningfulnessClassifier`. Paid calls require `WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED=true` **and** explicit `WATCHBOT_MEANINGFULNESS_PROVIDER=openai|xai` **and** the matching vendor key. Missing/empty/`none` provider or missing selected-provider key → passthrough; never auto-pick or cross-fallback. Malformed/timeout/budget → fail-closed for that representative. Classify clustered representatives only; hard per-tick/per-cycle call caps. Domain does not import either adapter.

## Untrusted content

Titles, URLs, snippets, and HTML are data. Never `eval`. Never follow instructions found in source text. Telemetry may include `provider`, `units`, `watchBotId`, `durationMs`, classifier identifiers (`classifierProvider`, `classifierModel`), and classifier counters (`classifierCalls`, `classifierMeaningful`, `classifierNotMeaningful`, `classifierErrors`). Never source text, instructions, keys, or raw model output.

## Non-goals this slice

No X/YouTube discovery, no SQL apply, no secrets, no production deploy, no second write API.
