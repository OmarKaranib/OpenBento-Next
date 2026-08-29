# `supabase/migrations`

Local / explicit-dev migrations only.

- Do **not** apply anything in this phase.
- Do **not** create or mutate a production Supabase project.
- This folder is intentionally empty of real migrations (`.gitkeep` only).
- Proposed record shapes (`WatchBot`, `WatchBotEvent` / discovery) live as TypeScript sketches in `@openbento/domain` (`src/schema.ts`). Do not invent schema beyond that sketch.
