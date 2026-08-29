# OpenBento-Next

AI-native live intelligence canvas (Canvas, Card, Frame, WatchBot).

**Canonical context:** [docs/OPENBENTO_MASTER_CONTEXT.md](./docs/OPENBENTO_MASTER_CONTEXT.md)

This is **Phase 1 Canvas** on top of the Phase 1 platform catalog. `apps/web` mounts a Railway-inspired workspace: left rail, top Canvas switcher, Agent placeholder, and an XYFlow dotted canvas. Humans can create, switch, and rename Canvases; add Note Cards from the top **Note** control or by double-clicking empty canvas (world coordinates, then `setCardFrame` from geometry); move and resize Notes and Frames; and fullscreen a Frame without rewriting stored geometry.

Persistence is the in-memory `DomainStore` behind `createActionExecutor`. There is no WatchBot pipeline, WebMCP tools, source Cards, Auth/`runBoundAction`, or production deploy.

Legacy [`OmarKaranib/OpenBento`](https://github.com/OmarKaranib/OpenBento) is frozen reference.

**Master roadmap:** [Issue #1](https://github.com/OmarKaranib/OpenBento-Next/issues/1) · [docs/ROADMAP.md](./docs/ROADMAP.md)

## Specs

Maintained under [`docs/`](./docs/). Copies also live at the repo root.

| Doc | Topic |
| --- | --- |
| [OPENBENTO_MASTER_CONTEXT.md](./docs/OPENBENTO_MASTER_CONTEXT.md) | Product + engineering source of truth |
| [PRODUCT_SPEC.md](./PRODUCT_SPEC.md) | Vision and primitives |
| [UI_SPEC.md](./UI_SPEC.md) | Railway-inspired chrome |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Monorepo, catalog, planned infra |
| [WATCHBOT_SPEC.md](./WATCHBOT_SPEC.md) | WatchBot contract |
| [WEBMCP_SPEC.md](./WEBMCP_SPEC.md) | Tool = domain action |
| [DECISIONS.md](./DECISIONS.md) | Locked decisions |
| [ANALYTICS.md](./ANALYTICS.md) | Event taxonomy |
| [HACKATHON.md](./HACKATHON.md) | WebMCP Challenge |
| [AGENTS.md](./AGENTS.md) | Contributor rules |

## Monorepo

```
apps/web                 Next.js 16 Railway-inspired workspace (CanvasRoot)
apps/worker              Worker stub
packages/domain          20-action catalog + shared executor + store port
packages/watchbot        SourceProvider types
packages/ui              Tokens
supabase/migrations      Local/dev SQL + RLS — do not apply to production
docs/                    Specs + master context
```

## Install and verify

Node 20+ and pnpm 10.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter web build
```

Local workspace (in-memory store, no hosted backend):

```bash
pnpm dev
```

## License

[MIT](./LICENSE)
