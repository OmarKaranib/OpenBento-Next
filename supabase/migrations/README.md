# `supabase/migrations`

Dev / explicit-dev migrations for the hosted **dev** project (org `openbento`, us-east-1).

- These SQL files match `packages/domain/src/schema.ts`.
- Do **not** apply them from this agent to any hosted database.
- Platform applies reviewed SQL to the **dev** project after review.
- Do **not** create or mutate a production Supabase project.
- Do **not** run `supabase db push` / `link` against production from this work.

## What landed

`20260829140000_init_openbento_schema.sql` creates:

- `canvases` (`owner_id`, viewport columns)
- `cards` (`type` + `jsonb payload` — not title/body)
- `frames`
- `watch_bots` (`instruction`, `status` in `running` / `paused` / `error`)
- `watch_bot_events` — `UNIQUE (watch_bot_id, dedup_key)` so one discovery fingerprint per bot; another bot may reuse the key
- same-canvas composite FK `watch_bot_events_card_same_canvas_fkey` `(card_id, canvas_id) → cards(id, canvas_id)`

`20260829200000_watch_bot_event_card_same_canvas.sql` is additive/idempotent: same-canvas card FK plus `apply_domain_transaction` (SECURITY INVOKER) so `createCard` + `setCardFrame` + unique claim cannot leave an orphan Card.

`20260904010000_primary_frame_columns.sql` establishes the Phase 1 dashboard model:

- each Canvas gets a non-null `primary_frame_id` and a database uniqueness constraint permits exactly one Frame row per Canvas;
- zero-Frame Canvases receive a 1600×900 `Dashboard` Frame;
- multi-Frame Canvases choose the oldest `created_at`, then lowest `id`, as primary; Cards on other Frames keep payload/provenance and world geometry, have `frame_id` cleared, and only then are the now-unreferenced extra Frames removed;
- `columns` is owner-scoped through its Canvas, with same-Canvas/primary-Frame constraints and bounded geometry;
- `cards.column_id` is explicit same-Canvas/Frame membership;
- every existing WatchBot receives a dedicated Column and `watch_bots.column_id` becomes required and unique; and
- `apply_domain_transaction` accepts the new fields/entities so Card + Frame + Column + dedup writes stay atomic.

Composite foreign key `cards_frame_same_canvas_fkey` prevents `card.frame_id` from pointing at a frame on another canvas.

## RLS

Every Canvas / Card / Frame / Column / WatchBot / WatchBotEvent policy is owner-scoped via `auth.uid()` (cards, frames, and columns join through canvas ownership). Never trust a client-supplied user id.

**Handlers must still call `assertSameCanvasMembership` before `setCardFrame`.** RLS is not a substitute for same-canvas Frame membership.

## Local apply (optional, not this agent)

When a **local** Supabase stack is running, apply only against that local database. Do not target a hosted project from this checkout.
