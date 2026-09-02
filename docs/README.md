# OpenBento-Next

AI-native live intelligence canvas (Canvas, Card, Frame, WatchBot).

**Canonical context:** [docs/OPENBENTO_MASTER_CONTEXT.md](./docs/OPENBENTO_MASTER_CONTEXT.md)

This is **Phase 3 durable persist** on `bot/platform-persist`. Runtime persistence is `getDomainStore()` → `SupabaseDomainStore` for the human UI, WebMCP, and the WatchBot worker. There is no production/runtime fallback to a process-wide `InMemoryDomainStore`. `InMemoryDomainStore` remains for isolated tests only.

Auth is **hosted Supabase Auth**. `requireOwnerIdFromRequest` resolves `ownerId` from `auth.uid()` / `getUser()`. It never accepts a client-supplied user id and never uses the unsigned `ob_local_session` cookie as the live path. **Reload / login restore is required for PASS.**

WatchBot writes sourced Cards through the same `createActionExecutor`. Canvas mutations go through `runBoundAction` / `runDomainAction`. Isolated WebMCP registers the Issue #1 tools on that same executor. No production deploy. Do not apply SQL to the hosted project from this checkout.

Legacy [`OmarKaranib/OpenBento`](https://github.com/OmarKaranib/OpenBento) is frozen reference.

**Master roadmap:** [Issue #1](https://github.com/OmarKaranib/OpenBento-Next/issues/1) · [docs/ROADMAP.md](./docs/ROADMAP.md)

## Specs

Maintained under [`docs/`](./docs/). Copies also live at the repo root.

| Doc | Topic |
| --- | --- |
| [OPENBENTO_MASTER_CONTEXT.md](./docs/OPENBENTO_MASTER_CONTEXT.md) | Product + engineering source of truth |
| [PRODUCT_SPEC.md](./PRODUCT_SPEC.md) | Vision and primitives |
| [UI_SPEC.md](./UI_SPEC.md) | Railway-inspired chrome |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Monorepo, catalog, persist, auth |
| [WATCHBOT_SPEC.md](./WATCHBOT_SPEC.md) | WatchBot contract |
| [WEBMCP_SPEC.md](./WEBMCP_SPEC.md) | Tool = domain action |
| [DECISIONS.md](./DECISIONS.md) | Locked decisions |
| [ANALYTICS.md](./ANALYTICS.md) | Event taxonomy |
| [HACKATHON.md](./HACKATHON.md) | WebMCP Challenge |
| [AGENTS.md](./AGENTS.md) | Contributor rules |
| [DEPLOY.md](./DEPLOY.md) | Gate 3 Railway/Auth prepare (do not deploy) |

## Monorepo

```
apps/web                 Next.js 16 Railway-inspired workspace (CanvasRoot) + WebMCP host
apps/worker              WatchBot worker (`createWorkerDomainStore()`; `--fixture` isolated only)
packages/domain          20-action catalog + shared executor + DomainStore + SupabaseDomainStore
packages/watchbot        SourceProvider + pipeline; optional Grok / OpenAI web adapters
packages/ui              Tokens
supabase/migrations      Dev SQL + RLS — do not apply from this agent
docs/                    Specs + master context
```

## Install and verify

Node 22.23.2 and pnpm 10.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter web build
pnpm --filter worker start          # durable createWorkerDomainStore (needs OPENBENTO_WORKER_ENABLED=true + service role)
pnpm --filter worker start:loop     # hosted loop (fail-closed unless enabled)
pnpm --filter worker start:fixture  # isolated InMemory only
```

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` plus the publishable/anon key. Hosted env **names** (no values) and Railway dashboard settings: [DEPLOY.md](./DEPLOY.md). Never commit secrets. The worker stays off unless `OPENBENTO_WORKER_ENABLED=true`.

```bash
pnpm dev
```

Sign in. Create a Canvas, reload, and confirm state restores from the DomainStore.

## WebMCP

13 tools from `WEBMCP_TOOL_TO_ACTION`. Each `registerTool` execute calls `runWebMcpTool` → `runBoundAction({ getOwnerId: requireOwnerIdFromRequest, store: getDomainStore() })` → `createActionExecutor`. Tools share the Canvas store. No demo tools. Unset session fails closed (`unauthenticated`).

```bash
pnpm --filter web dev   # canvas at / registers tools; judge notes at /webmcp
pnpm test               # request-scoped eval (requestAuthFromVerifiedUser in tests)
```

See [WEBMCP_SPEC.md](./WEBMCP_SPEC.md).

## License

[MIT](./LICENSE)
