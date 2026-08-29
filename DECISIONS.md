# DECISIONS — OpenBento-Next

ADR-style log. Newest at the bottom. These are binding unless a later ADR supersedes them.

---

## ADR-001 — Fresh repo; legacy frozen

- **Decision:** Rebuild in `OmarKaranib/OpenBento-Next`. `OmarKaranib/OpenBento` is frozen reference. Do not modify the legacy repo. Do not port the 12-column Vite/Express widget dashboard.
- **Why:** This is a different product (canvas + WatchBot + WebMCP), not a lift-and-shift.

## ADR-002 — Next.js 16 + pnpm workspaces

- **Decision:** TypeScript monorepo via pnpm workspaces. `apps/web` is Next.js **16** App Router (not 15). Root `packageManager` is pnpm.
- **Why:** Current Next App Router for the eventual canvas + WebMCP page; workspace packages for shared domain.

## ADR-003 — `@xyflow/react` for canvas (later)

- **Decision:** `apps/web` depends on `@xyflow/react`. Mount lives in `src/components/canvas/CanvasRoot.tsx` and is **not** wired in this phase.
- **Why:** Declare the canvas engine without building product UI in the scaffold.

## ADR-004 — Zoom is navigation only

- **Decision:** Zoom, pan, and fit change the viewport camera only. **No semantic zoom.** Zoom never changes information architecture, object types, or nesting.
- **Why:** Semantic zoom would fight Frames, Cards, and a 1:1 agent tool surface.

## ADR-005 — Railway-like chrome

- **Decision:** Compact left rail (Canvases, WatchBots, Settings; **Profile fixed at the bottom**). Top-left: current Canvas name/selector + WatchBot status. Top-right: Agent. Bottom-left: Railway-like **vertical** canvas toolbar (grid/snap if useful, zoom in, zoom out, fit, Frame tool, undo, redo, overview/layers if useful). Dark infinite dotted canvas.
- **Why:** Recorded UI contract for all later chrome work. See `UI_SPEC.md`.

## ADR-006 — Frames are fullscreenable bordered regions

- **Decision:** Frames are bordered display regions on the canvas and can be fullscreened. They are not zoom levels and not a semantic hierarchy. **Fullscreen is view-only presentation** and must **not** rewrite stored Frame or Card geometry.
- **Why:** Presentation without changing IA or persisted layout.

## ADR-007 — Shared domain actions for UI / WatchBot / WebMCP

- **Decision:** One catalog in `packages/domain`. Locked names: `createWatchBot`, `pauseWatchBot`, `createCard`, `updateCard`, `setCardFrame`. WebMCP tools map 1:1 via `document.modelContext.registerTool({ name, description, inputSchema, execute })`.
- **Why:** Human, WatchBot, and agent must not diverge. WatchBot Engineer builds against this catalog.

## ADR-008 — MIT license for WebMCP Challenge detectability

- **Decision:** Keep the existing MIT `LICENSE` at repo root so GitHub detects it in About.
- **Why:** Challenge rule: public repo with a detectable open-source license.

## ADR-009 — No production infra this phase

- **Decision:** No Vercel/hosting deploy. No production Supabase project, no applied migrations, no DNS, no spend, no merge to `main` without approval. `supabase/migrations` stays empty of real migrations. `.env.example` has public placeholders only.
- **Why:** Scaffold + docs only.

## ADR-010 — Card provenance is required

- **Decision:** `createCard` and `updateCard` **require** provenance: source URL, title, `published_at` / `publishedAt`, `source_type` / `sourceType`. No provenance-less card path for any actor.
- **Why:** WatchBot Cards are sourced intelligence, not anonymous blobs. Agents and UI stay honest.

## ADR-011 — Local schema sketch: WatchBot + WatchBotEvent only

- **Decision:** Proposed local/dev records are `WatchBot` (`watch_bots`) and `WatchBotEvent` / discovery (`watch_bot_events`) for dedup and novelty. Types + comments in `packages/domain/src/schema.ts`. **No invented schema. No SQL migrations in this phase.**
- **Why:** Give WatchBot Engineer a contract without creating or applying a database.

## ADR-012 — WatchBot Engineer first slice

- **Decision:** First slice is **web/news only**. Provider-agnostic `SourceProvider` in `packages/watchbot`; first adapter is **xAI/Grok** and is **not wired into the domain**. Pipeline (later, `apps/worker`): discover → normalize → dedup → novelty → relevance → provenance → Card. YouTube and X after web is honest. Work starts on a **branch after this scaffold merges**. **No merge to `main` without Bento Lead review.**
- **Why:** Keep domain vendor-free; make web honest before more sources; keep this PR a scaffold.

## ADR-013 — `setCardFrame` from spatial containment; zoom stays camera-only

- **Decision:** Frame membership is derived from spatial containment (card placed inside / moved outside a Frame) and applied through the shared action `setCardFrame` (`frameId` or `null`). The UI must not invent membership. Fullscreen Frame is view-only and does not persist or rewrite geometry. Zoom remains camera-only; no semantic zoom.
- **Why:** UI, WatchBot, and WebMCP share one membership write path. Presentation and camera must not mutate stored layout.
