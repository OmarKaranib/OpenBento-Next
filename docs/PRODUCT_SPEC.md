# PRODUCT_SPEC — OpenBento-Next

Canonical: [`docs/OPENBENTO_MASTER_CONTEXT.md`](./docs/OPENBENTO_MASTER_CONTEXT.md).

> Tell OpenBento what you want to follow. It builds and maintains a living canvas of the relevant sources, media, reactions, and developments.

**AI organizes the story. Sources remain the story.**

## Primitives

| Primitive | Definition |
| --- | --- |
| **Canvas** | Persistent spatial workspace. Camera zoom only. Viewport persistable. |
| **Card** | Positioned, resizable content. `type` + typed payload (Note first). Source types carry provenance; notes do not. |
| **Frame** | Persisted bordered region. Fullscreen is view-only. |
| **WatchBot** | Persistent monitor (`running` \| `paused` \| `error`). Requires an instruction. |

Interactive **Agent** (top-right) is not a WatchBot.

## Shared actions

Human UI, WatchBot, and model-facing surfaces reuse actions from `@openbento/domain` (see `ARCHITECTURE.md`). The Agent and WebMCP expose safe allowlisted subsets. `ownerId` is never an action input. Provenance is required on source Cards only.

## Users and loops

- **Human:** create/switch Canvas, place Cards, navigate/fullscreen the fixed dashboard Frame, talk to Agent, pause/resume WatchBots.
- **WatchBot:** follow `instruction`, write sourced Cards through the catalog.
- **Agent / WebMCP:** safe allowlisted catalog actions only; Frame geometry mutations are not model-facing.

## v1 intent vs this phase

v1 includes Railway chrome, XYFlow canvas, Note + source Cards, Frames, WatchBot worker, WebMCP parity, local/dev Supabase.

This phase is foundation only: catalog, docs, lint/typecheck/test/build. No product UI, pipeline, tools, billing, or production infra.

Legacy `OmarKaranib/OpenBento` is reference only.
