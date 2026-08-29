# OpenBento-Next

Fresh rebuild of OpenBento: an **AI-native live intelligence canvas** (Canvas, Card, Frame, WatchBot).

This repository is a **scaffold** — authoritative docs, a pnpm/TypeScript monorepo, and shared domain **types** for WatchBot Engineer. There is no working canvas, no WatchBot pipeline, and no deploy.

**Legacy** [`OmarKaranib/OpenBento`](https://github.com/OmarKaranib/OpenBento) is frozen reference. Do not modify it. This is not a port of the old 12-column dashboard.

**Master roadmap:** [Master roadmap: OpenBento-Next rebuild](https://github.com/OmarKaranib/OpenBento-Next/issues/1)

## Specs

Maintained under [`docs/`](./docs/). Copies also live at the repo root for GitHub visibility.

| Doc | What it is |
| --- | --- |
| [PRODUCT_SPEC.md](./PRODUCT_SPEC.md) | Vision, primitives, loops, v1 in/out |
| [UI_SPEC.md](./UI_SPEC.md) | Railway-inspired chrome; zoom is navigation |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Monorepo, shared actions, schema sketch |
| [WATCHBOT_SPEC.md](./WATCHBOT_SPEC.md) | Lifecycle, first slice, pipeline (not implemented) |
| [WEBMCP_SPEC.md](./WEBMCP_SPEC.md) | Challenge tools = domain actions |
| [DECISIONS.md](./DECISIONS.md) | ADR log |
| [HACKATHON.md](./HACKATHON.md) | WebMCP Challenge submission notes |
| [AGENTS.md](./AGENTS.md) | Rebuild rules for agents |

## Monorepo

```
apps/web                 Next.js 16 App Router (placeholder page)
apps/worker              Worker stub (future WatchBot pipeline home)
packages/domain          Shared actions + types + local schema sketch
packages/watchbot        SourceProvider + runtime types (no implementation)
packages/ui              Token stub
supabase/migrations      Empty — local/dev only; do not apply
docs/                    Maintained spec copies
```

Shared actions: `createWatchBot`, `pauseWatchBot`, `createCard`, `updateCard`, `setCardFrame`. Card provenance is required. Frame membership is `setCardFrame` only. See `@openbento/domain`.

## Install

Requires Node 20+ and [pnpm](https://pnpm.io/) 10.

```bash
pnpm install
```

Dev / build the placeholder Next app:

```bash
pnpm --filter web dev
pnpm --filter web build
```

(`pnpm build` at the repo root is the same web build.)

The home page is title/copy only: **OpenBento Next (rebuild scaffold)**. `@xyflow/react` is declared but not mounted (`apps/web/src/components/canvas/CanvasRoot.tsx`).

## License

[MIT](./LICENSE) — kept at the repo root so GitHub detects it for the WebMCP Challenge.
