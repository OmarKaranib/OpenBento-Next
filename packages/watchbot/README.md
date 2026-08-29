# `@openbento/watchbot`

WatchBot **runtime stub**. Types and this README only.

A WatchBot is a persistent monitoring agent bound to a Canvas. Status is `running` | `paused` | `error` only, shown near the current Canvas name.

It mutates the world only through `@openbento/domain` actions. `createWatchBot` requires an `instruction`. `ownerId` is session-derived.

## SourceProvider

Provider-agnostic port in `src/provider.ts`. First adapter (planned): xAI/Grok, not wired into the domain.

Initial sources from the master context: web/news, then X, then YouTube. Implementation is later in `apps/worker`.

## Pipeline (not implemented)

`discover → normalize → dedup → novelty → relevance → provenance → Card`
