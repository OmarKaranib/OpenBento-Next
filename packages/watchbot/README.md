# `@openbento/watchbot`

WatchBot **v0 first slice**: provider-agnostic discovery port plus the
`discover → normalize → dedup → novelty → relevance → select → provenance → Card`
pipeline. Selection ranks eligible candidates (passed normalize/dedup/novelty/
relevance) before any Card is created.

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

The official X API v2 adapter is in `src/adapters/x.ts`. It is read-only and
disabled by default. It requires both `X_PROVIDER_ENABLED=true` and the
worker-only `X_BEARER_TOKEN`; it never posts, replies, likes, follows, sends
DMs, or mutates X. It enforces code-level query, request, page, result, and
timeout limits. X stays `sourceType: "x"` through normalization and Card
creation. YouTube discovery is not implemented.

## Pipeline

`runWatchBotPipeline` claims `UNIQUE (watchBotId, dedupKey)` on the first
normalized event. Conflict → `duplicate`, no Card, no overwrite. Membership is
two calls: `createCard` (bounds only) then `setCardFrame` using
`selectSmallestContainingFrame`.
