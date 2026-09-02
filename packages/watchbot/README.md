# `@openbento/watchbot`

WatchBot **v0 first slice**: provider-agnostic discovery port plus the
`discover → normalize → dedup → novelty → relevance → cluster → meaning → select → provenance → Card`
pipeline. Selection ranks same-story representatives of eligible candidates
(passed normalize/dedup/novelty/relevance, then conservative near-duplicate
clustering, then an optional meaningful-development classifier) before any
Card is created.

A WatchBot is a persistent monitoring agent bound to a Canvas. Status is
`running` | `paused` | `error` only.

It mutates the world only through `@openbento/domain` actions via
`createActionExecutor`. `createWatchBot` requires an `instruction`.
`ownerId` is session-derived.

## Meaningfulness (Slice C)

`packages/watchbot/src/meaningfulness.ts` is a **provider-independent
classifier contract**, not a lexical scorer. Distinguishing relevant chatter
from a genuine development is semantic; this package does not encode
ASCII/English keyword gates and does not call X/Grok. Production default is
passthrough (all representatives remain eligible, importance `0`) so ordinary
web/news/X behavior is unchanged. When a classifier is injected,
`meaningful: false` excludes that representative before Card creation.
Ranking after clustering is `importance → relevance → novelty → arrivalIndex`.
Adapters stay out of `@openbento/domain`.

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
