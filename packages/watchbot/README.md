# `@openbento/watchbot`

WatchBot **v0 first slice**: provider-agnostic discovery port plus the
`discover → normalize → dedup → novelty → relevance → provenance → Card` pipeline.

A WatchBot is a persistent monitoring agent bound to a Canvas. Status is
`running` | `paused` | `error` only.

It mutates the world only through `@openbento/domain` actions via
`createActionExecutor`. `createWatchBot` requires an `instruction`.
`ownerId` is session-derived.

## SourceProvider

Provider-agnostic port in `src/provider.ts`. Tests inject `FakeSourceProvider`.
An optional xAI/Grok adapter lives in `src/adapters/grok.ts` and is constructed
only when `XAI_API_KEY` / `GROK_API_KEY` is set. `@openbento/domain` does not
import Grok.

First slice sources: **web and news only**. X and YouTube discovery are not
implemented.

## Pipeline

`runWatchBotPipeline` claims `UNIQUE (watchBotId, dedupKey)` on the first
normalized event. Conflict → `duplicate`, no Card, no overwrite. Membership is
two calls: `createCard` (bounds only) then `setCardFrame` using
`selectSmallestContainingFrame`.
