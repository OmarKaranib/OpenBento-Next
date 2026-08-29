# Agent rules — OpenBento-Next rebuild

This repository is the **fresh rebuild** of OpenBento. Read the specs before changing product, UI, or architecture.

## Frozen / forbidden

- **Do not modify** [`OmarKaranib/OpenBento`](https://github.com/OmarKaranib/OpenBento). It is legacy/reference only. This rebuild is a different product.
- **Do not copy** the legacy 12-column widget dashboard (Vite + Express) architecture.
- **Do not deploy** (Vercel or any host), create or mutate a **production** Supabase project, change DNS, spend money, or **merge to `main`** without explicit human / Bento Lead approval.
- **Do not apply** migrations. `supabase/migrations` is local/dev only and currently empty of real migrations.

## Shared domain actions (mandatory)

Human UI, WatchBot, and WebMCP **must** converge on the same shared domain/application actions in `packages/domain` (`@openbento/domain`).

- Do not give WatchBot or WebMCP a private mutation API.
- WebMCP tools map 1:1 to catalog entries via `document.modelContext.registerTool({ name, description, inputSchema, execute })`.
- Required catalog actions: `createWatchBot`, `pauseWatchBot`, `createCard`, `updateCard`, `setCardFrame`.
- `createCard` and `updateCard` **require** provenance: `sourceUrl`, `title`, `publishedAt` (`published_at`), `sourceType` (`source_type`).
- `setCardFrame` is the only write path for Frame membership (spatial containment). Fullscreen is view-only and must not rewrite stored geometry.
- Do not implement handlers or a real pipeline in the scaffold. Types and docs only until a later phase.

## WatchBot Engineer (first slice — after scaffold merge)

- **web/news only.** YouTube and X come after web is honest.
- Provider-agnostic `SourceProvider` lives in `packages/watchbot`. First adapter is xAI/Grok and is **not** wired into the domain.
- Pipeline (implement later in `apps/worker`, not here): discover → normalize → dedup → novelty → relevance → provenance → Card.
- Work lands in `apps/worker` on a **branch after this scaffold merges**.
- **No invented schema.** Use the proposed local record sketch in `@openbento/domain` (`WatchBot`, `WatchBotEvent` / discovery).
- **No merge to `main` without Bento Lead review.**

## Zoom

Zoom is **navigation only**. Never introduce semantic zoom hierarchy. Zoom must not change information architecture.

## Merge bar

Integration review is required before any merge to `main`: UI, WatchBot, and WebMCP still share `packages/domain`. Bento Lead reviews WatchBot Engineer work.

## This phase

Scaffold + authoritative docs + one master roadmap issue. No product features. No working canvas UI. No production infra.
