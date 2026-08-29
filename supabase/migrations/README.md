# `supabase/migrations`

Local / explicit-dev migrations only.

- These SQL files match `packages/domain/src/schema.ts`.
- Do **not** apply them to a hosted or production database.
- Do **not** create or mutate a production Supabase project.
- Do **not** run `supabase db push` / `link` against production from this work.

## What landed

`20260829140000_init_openbento_schema.sql` creates:

- `canvases` (`owner_id`, viewport columns)
- `cards` (`type` + `jsonb payload` — not title/body)
- `frames`
- `watch_bots` (`instruction`, `status` in `running` / `paused` / `error`)
- `watch_bot_events`

Composite foreign key `cards_frame_same_canvas_fkey` prevents `card.frame_id` from pointing at a frame on another canvas.

## RLS

Every Canvas / Card / Frame / WatchBot / WatchBotEvent policy is owner-scoped via `auth.uid()` (cards and frames join through canvas ownership). Never trust a client-supplied user id.

**Handlers must still call `assertSameCanvasMembership` before `setCardFrame`.** RLS is not a substitute for same-canvas Frame membership.

## Local apply (optional, not production)

When a **local** Supabase stack is running, apply only against that local database. Do not target a hosted project.
