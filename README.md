# OpenBento-Next

AI-native live intelligence canvas (Canvas, Card, Frame, WatchBot).

**Canonical context:** [docs/OPENBENTO_MASTER_CONTEXT.md](./docs/OPENBENTO_MASTER_CONTEXT.md)

This is **Phase 0 foundation**: full shared domain catalog, docs, and green lint/typecheck/test/build. There is no working canvas, WatchBot pipeline, WebMCP tools, or deploy.

Legacy [`OmarKaranib/OpenBento`](https://github.com/OmarKaranib/OpenBento) is frozen reference.

**Master roadmap:** [Issue #1](https://github.com/OmarKaranib/OpenBento-Next/issues/1)

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
apps/web                 Next.js 16 placeholder
apps/worker              Worker stub
packages/domain          Full 20-action catalog
packages/watchbot        SourceProvider types
packages/ui              Tokens
supabase/migrations      Empty — do not apply
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

## License

[MIT](./LICENSE)
