-- Local / explicit-dev schema only.
-- Do NOT apply this migration to a hosted or production database.
-- Do NOT create or mutate a production Supabase project.
--
-- Record shapes match packages/domain/src/schema.ts:
--   canvases, cards (type + jsonb payload — not title/body columns),
--   frames, watch_bots (instruction, status running/paused/error),
--   watch_bot_events.
--
-- RLS is owner-scoped via auth.uid(). Cards and frames join through canvas
-- ownership. Never trust a client-supplied user id.
--
-- Handlers must still call assertSameCanvasMembership before setCardFrame.
-- RLS is not a substitute for same-canvas Frame membership checks.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.canvases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) > 0),
  viewport_x double precision not null default 0,
  viewport_y double precision not null default 0,
  viewport_zoom double precision not null default 1 check (viewport_zoom > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_opened_at timestamptz,
  unique (id, owner_id)
);

create table public.frames (
  id uuid primary key default gen_random_uuid(),
  canvas_id uuid not null references public.canvases (id) on delete cascade,
  name text,
  x double precision not null,
  y double precision not null,
  width double precision not null check (width > 0),
  height double precision not null check (height > 0),
  z_index integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, canvas_id)
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  canvas_id uuid not null references public.canvases (id) on delete cascade,
  frame_id uuid,
  type text not null check (
    type in (
      'note',
      'article',
      'web',
      'news',
      'youtube',
      'x',
      'reddit',
      'instagram',
      'ai_summary',
      'watchbot_status',
      'timeline',
      'chart'
    )
  ),
  payload jsonb not null,
  x double precision not null,
  y double precision not null,
  width double precision not null check (width > 0),
  height double precision not null check (height > 0),
  z_index integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, canvas_id),
  -- Composite FK: frame_id cannot point at a frame on another canvas.
  -- MATCH SIMPLE: a null frame_id skips the check. ON DELETE RESTRICT so
  -- membership must be cleared before deleting a Frame.
  constraint cards_frame_same_canvas_fkey
    foreign key (frame_id, canvas_id)
    references public.frames (id, canvas_id)
);

create table public.watch_bots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  canvas_id uuid not null references public.canvases (id) on delete cascade,
  name text,
  instruction text not null check (char_length(instruction) > 0),
  status text not null check (status in ('running', 'paused', 'error')),
  source_types text[] not null default '{}',
  last_error text,
  last_activity_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, canvas_id),
  unique (id, owner_id),
  constraint watch_bots_source_types_valid check (
    source_types <@ array['web', 'news', 'youtube', 'x']::text[]
  ),
  -- Owner must match the canvas owner. Never trust a client-supplied user id.
  constraint watch_bots_canvas_owner_fkey
    foreign key (canvas_id, owner_id)
    references public.canvases (id, owner_id)
    on delete cascade
);

create table public.watch_bot_events (
  id uuid primary key default gen_random_uuid(),
  watch_bot_id uuid not null,
  canvas_id uuid not null,
  kind text not null check (
    kind in (
      'discovered',
      'normalized',
      'duplicate',
      'novel',
      'rejected_relevance',
      'card_created',
      'error'
    )
  ),
  source_url text not null,
  dedup_key text not null,
  novelty_score double precision,
  discovered_at timestamptz not null default now(),
  title text,
  published_at timestamptz,
  source_type text check (
    source_type is null
    or source_type in ('web', 'news', 'youtube', 'x', 'reddit', 'instagram')
  ),
  card_id uuid,
  detail text,
  constraint watch_bot_events_bot_canvas_fkey
    foreign key (watch_bot_id, canvas_id)
    references public.watch_bots (id, canvas_id)
    on delete cascade,
  constraint watch_bot_events_card_id_fkey
    foreign key (card_id)
    references public.cards (id)
    on delete set null,
  -- Same-canvas composite FK: an event cannot point at a Card on another
  -- Canvas/user. MATCH SIMPLE: a null card_id skips the check.
  -- cards already has unique (id, canvas_id).
  constraint watch_bot_events_card_same_canvas_fkey
    foreign key (card_id, canvas_id)
    references public.cards (id, canvas_id),
  -- One discovery fingerprint per WatchBot. Another bot may reuse the same key.
  constraint watch_bot_events_watch_bot_id_dedup_key_key
    unique (watch_bot_id, dedup_key)
);

-- ---------------------------------------------------------------------------
-- Indexes (FK + RLS columns)
-- ---------------------------------------------------------------------------

create index canvases_owner_id_idx on public.canvases (owner_id);
create index frames_canvas_id_idx on public.frames (canvas_id);
create index cards_canvas_id_idx on public.cards (canvas_id);
create index cards_frame_id_idx on public.cards (frame_id) where frame_id is not null;
create index watch_bots_owner_id_idx on public.watch_bots (owner_id);
create index watch_bots_canvas_id_idx on public.watch_bots (canvas_id);
create index watch_bot_events_watch_bot_id_idx on public.watch_bot_events (watch_bot_id);
create index watch_bot_events_canvas_id_idx on public.watch_bot_events (canvas_id);

-- ---------------------------------------------------------------------------
-- updated_at (not security definer)
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger canvases_set_updated_at
  before update on public.canvases
  for each row execute function public.set_updated_at();

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

create trigger frames_set_updated_at
  before update on public.frames
  for each row execute function public.set_updated_at();

create trigger watch_bots_set_updated_at
  before update on public.watch_bots
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges: authenticated only. anon/public get nothing.
-- ---------------------------------------------------------------------------

revoke all on table public.canvases from public, anon;
revoke all on table public.cards from public, anon;
revoke all on table public.frames from public, anon;
revoke all on table public.watch_bots from public, anon;
revoke all on table public.watch_bot_events from public, anon;

grant select, insert, update, delete on table public.canvases to authenticated;
grant select, insert, update, delete on table public.cards to authenticated;
grant select, insert, update, delete on table public.frames to authenticated;
grant select, insert, update, delete on table public.watch_bots to authenticated;
grant select, insert, update, delete on table public.watch_bot_events to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — every access is owner-scoped via auth.uid().
-- auth.uid() is wrapped in SELECT so Postgres caches it (not per-row).
-- UPDATE policies include SELECT (USING) plus WITH CHECK.
-- ---------------------------------------------------------------------------

alter table public.canvases enable row level security;
alter table public.canvases force row level security;

alter table public.cards enable row level security;
alter table public.cards force row level security;

alter table public.frames enable row level security;
alter table public.frames force row level security;

alter table public.watch_bots enable row level security;
alter table public.watch_bots force row level security;

alter table public.watch_bot_events enable row level security;
alter table public.watch_bot_events force row level security;

-- canvases
create policy canvases_select_own on public.canvases
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy canvases_insert_own on public.canvases
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy canvases_update_own on public.canvases
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy canvases_delete_own on public.canvases
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- cards: join through canvas ownership. Never trust a client-supplied user id.
create policy cards_select_own on public.cards
  for select to authenticated
  using (
    exists (
      select 1
      from public.canvases
      where canvases.id = cards.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  );

create policy cards_insert_own on public.cards
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.canvases
      where canvases.id = cards.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  );

create policy cards_update_own on public.cards
  for update to authenticated
  using (
    exists (
      select 1
      from public.canvases
      where canvases.id = cards.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.canvases
      where canvases.id = cards.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  );

create policy cards_delete_own on public.cards
  for delete to authenticated
  using (
    exists (
      select 1
      from public.canvases
      where canvases.id = cards.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  );

-- frames: join through canvas ownership
create policy frames_select_own on public.frames
  for select to authenticated
  using (
    exists (
      select 1
      from public.canvases
      where canvases.id = frames.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  );

create policy frames_insert_own on public.frames
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.canvases
      where canvases.id = frames.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  );

create policy frames_update_own on public.frames
  for update to authenticated
  using (
    exists (
      select 1
      from public.canvases
      where canvases.id = frames.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.canvases
      where canvases.id = frames.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  );

create policy frames_delete_own on public.frames
  for delete to authenticated
  using (
    exists (
      select 1
      from public.canvases
      where canvases.id = frames.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  );

-- watch_bots: owner_id plus canvas ownership
create policy watch_bots_select_own on public.watch_bots
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.canvases
      where canvases.id = watch_bots.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  );

create policy watch_bots_insert_own on public.watch_bots
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.canvases
      where canvases.id = watch_bots.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  );

create policy watch_bots_update_own on public.watch_bots
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.canvases
      where canvases.id = watch_bots.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.canvases
      where canvases.id = watch_bots.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  );

create policy watch_bots_delete_own on public.watch_bots
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.canvases
      where canvases.id = watch_bots.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  );

-- watch_bot_events: through watch_bot + canvas ownership
create policy watch_bot_events_select_own on public.watch_bot_events
  for select to authenticated
  using (
    exists (
      select 1
      from public.watch_bots
      join public.canvases on canvases.id = watch_bots.canvas_id
      where watch_bots.id = watch_bot_events.watch_bot_id
        and watch_bots.owner_id = (select auth.uid())
        and canvases.owner_id = (select auth.uid())
    )
  );

create policy watch_bot_events_insert_own on public.watch_bot_events
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.watch_bots
      join public.canvases on canvases.id = watch_bots.canvas_id
      where watch_bots.id = watch_bot_events.watch_bot_id
        and watch_bots.owner_id = (select auth.uid())
        and canvases.owner_id = (select auth.uid())
    )
  );

create policy watch_bot_events_update_own on public.watch_bot_events
  for update to authenticated
  using (
    exists (
      select 1
      from public.watch_bots
      join public.canvases on canvases.id = watch_bots.canvas_id
      where watch_bots.id = watch_bot_events.watch_bot_id
        and watch_bots.owner_id = (select auth.uid())
        and canvases.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.watch_bots
      join public.canvases on canvases.id = watch_bots.canvas_id
      where watch_bots.id = watch_bot_events.watch_bot_id
        and watch_bots.owner_id = (select auth.uid())
        and canvases.owner_id = (select auth.uid())
    )
  );

create policy watch_bot_events_delete_own on public.watch_bot_events
  for delete to authenticated
  using (
    exists (
      select 1
      from public.watch_bots
      join public.canvases on canvases.id = watch_bots.canvas_id
      where watch_bots.id = watch_bot_events.watch_bot_id
        and watch_bots.owner_id = (select auth.uid())
        and canvases.owner_id = (select auth.uid())
    )
  );

comment on table public.canvases is
  'Owner-scoped spatial workspace. owner_id is session-derived (auth.uid()), never an action input.';

comment on table public.cards is
  'Canvas cards store type + jsonb payload (not title/body). Handlers must call assertSameCanvasMembership before setCardFrame; RLS is not a substitute.';

comment on table public.frames is
  'Persisted bordered canvas regions. fullscreenFrame must not rewrite stored geometry.';

comment on table public.watch_bots is
  'Persistent monitors. status is running | paused | error. instruction is required.';

comment on table public.watch_bot_events is
  'Discovery / dedup / novelty records for WatchBot. Local/dev schema only.';

comment on column public.cards.payload is
  'Typed JSON matching PAYLOAD_SCHEMAS[type]. Notes are { text }; source types require provenance.';

comment on constraint cards_frame_same_canvas_fkey on public.cards is
  'Prevents card.frame_id from referencing a frame on another canvas. Handlers still call assertSameCanvasMembership.';

comment on constraint watch_bot_events_watch_bot_id_dedup_key_key on public.watch_bot_events is
  'One discovery fingerprint per WatchBot. A different WatchBot may reuse the same dedup_key.';

comment on constraint watch_bot_events_card_same_canvas_fkey on public.watch_bot_events is
  'Prevents watch_bot_events.card_id from referencing a card on another canvas. MATCH SIMPLE so a null card_id is allowed.';
