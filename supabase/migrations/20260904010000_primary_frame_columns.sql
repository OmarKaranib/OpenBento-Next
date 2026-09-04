-- Phase 1 dashboard architecture: singleton primary Frame + first-class Columns.
-- Local / explicit-dev migration only. Do not apply to production from an agent.

-- ---------------------------------------------------------------------------
-- Preserve legacy content, choose one deterministic Frame, bootstrap zero-Frame
-- Canvases, then enforce exactly one Frame per Canvas.
-- ---------------------------------------------------------------------------

alter table public.canvases add column primary_frame_id uuid;

insert into public.frames (id, canvas_id, name, x, y, width, height, created_at, updated_at)
select gen_random_uuid(), c.id, 'Dashboard', 0, 0, 1600, 900, c.created_at, now()
from public.canvases c
where not exists (
  select 1 from public.frames f where f.canvas_id = c.id
);

with ranked as (
  select
    f.id,
    f.canvas_id,
    row_number() over (
      partition by f.canvas_id
      order by f.created_at asc, f.id asc
    ) as ordinal
  from public.frames f
)
update public.canvases c
set primary_frame_id = ranked.id
from ranked
where ranked.canvas_id = c.id and ranked.ordinal = 1;

-- Cards from legacy extra Frames keep their content, provenance, and world
-- geometry. They become free-floating/parked before those empty shells go away.
update public.cards card
set frame_id = null, updated_at = now()
from public.canvases canvas
where card.canvas_id = canvas.id
  and card.frame_id is not null
  and card.frame_id <> canvas.primary_frame_id;

delete from public.frames frame
using public.canvases canvas
where frame.canvas_id = canvas.id
  and frame.id <> canvas.primary_frame_id;

alter table public.frames
  add constraint frames_one_per_canvas_key unique (canvas_id);

alter table public.canvases
  alter column primary_frame_id set not null,
  add constraint canvases_primary_frame_same_canvas_fkey
    foreign key (primary_frame_id, id)
    references public.frames (id, canvas_id)
    deferrable initially deferred;

comment on column public.canvases.primary_frame_id is
  'Authoritative singleton primary Frame. Same-canvas FK + frames(canvas_id) uniqueness enforce exactly one.';

-- ---------------------------------------------------------------------------
-- First-class persisted Columns and explicit Card membership.
-- ---------------------------------------------------------------------------

create table public.columns (
  id uuid primary key default gen_random_uuid(),
  canvas_id uuid not null references public.canvases (id) on delete cascade,
  frame_id uuid not null,
  name text not null check (char_length(name) > 0),
  x double precision not null,
  y double precision not null,
  width double precision not null check (width between 280 and 1200),
  height double precision not null check (height between 320 and 900),
  z_index integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, canvas_id),
  unique (id, canvas_id, frame_id),
  constraint columns_primary_frame_same_canvas_fkey
    foreign key (frame_id, canvas_id)
    references public.frames (id, canvas_id)
);

alter table public.cards add column column_id uuid;
alter table public.watch_bots add column column_id uuid;

create temporary table watchbot_column_backfill on commit drop as
select
  wb.id as watch_bot_id,
  gen_random_uuid() as column_id,
  wb.canvas_id,
  c.primary_frame_id as frame_id,
  coalesce(nullif(btrim(wb.name), ''), 'WatchBot') || ' feed' as name,
  row_number() over (
    partition by wb.canvas_id order by wb.created_at asc, wb.id asc
  ) as ordinal,
  wb.created_at,
  wb.updated_at
from public.watch_bots wb
join public.canvases c on c.id = wb.canvas_id;

insert into public.columns (
  id, canvas_id, frame_id, name, x, y, width, height, created_at, updated_at
)
select
  column_id,
  canvas_id,
  frame_id,
  name,
  40 + ((ordinal - 1) * 344),
  80,
  320,
  780,
  created_at,
  updated_at
from watchbot_column_backfill;

update public.watch_bots wb
set column_id = backfill.column_id
from watchbot_column_backfill backfill
where backfill.watch_bot_id = wb.id;

alter table public.watch_bots
  alter column column_id set not null,
  add constraint watch_bots_column_same_canvas_fkey
    foreign key (column_id, canvas_id)
    references public.columns (id, canvas_id),
  add constraint watch_bots_one_per_column_key unique (column_id);

alter table public.cards
  add constraint cards_column_requires_frame_check
    check (column_id is null or frame_id is not null),
  add constraint cards_column_same_primary_frame_fkey
    foreign key (column_id, canvas_id, frame_id)
    references public.columns (id, canvas_id, frame_id);

create index columns_canvas_id_idx on public.columns (canvas_id);
create index columns_frame_id_idx on public.columns (frame_id);
create index cards_column_id_idx on public.cards (column_id) where column_id is not null;

create trigger columns_set_updated_at
  before update on public.columns
  for each row execute function public.set_updated_at();

revoke all on table public.columns from public, anon;
grant select, insert, update, delete on table public.columns to authenticated;

alter table public.columns enable row level security;
alter table public.columns force row level security;

create policy columns_select_own on public.columns
  for select to authenticated
  using (
    exists (
      select 1 from public.canvases
      where canvases.id = columns.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  );

create policy columns_insert_own on public.columns
  for insert to authenticated
  with check (
    exists (
      select 1 from public.canvases
      where canvases.id = columns.canvas_id
        and canvases.owner_id = (select auth.uid())
        and canvases.primary_frame_id = columns.frame_id
    )
  );

create policy columns_update_own on public.columns
  for update to authenticated
  using (
    exists (
      select 1 from public.canvases
      where canvases.id = columns.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.canvases
      where canvases.id = columns.canvas_id
        and canvases.owner_id = (select auth.uid())
        and canvases.primary_frame_id = columns.frame_id
    )
  );

create policy columns_delete_own on public.columns
  for delete to authenticated
  using (
    exists (
      select 1 from public.canvases
      where canvases.id = columns.canvas_id
        and canvases.owner_id = (select auth.uid())
    )
  );

comment on table public.columns is
  'Persisted bounded vertical Card streams in the Canvas primary Frame.';
comment on column public.cards.column_id is
  'Explicit Column membership. Null means free-floating; ordering is created_at DESC, id DESC.';
comment on column public.watch_bots.column_id is
  'Dedicated output Column. UNIQUE enforces at most one WatchBot per Column.';

-- ---------------------------------------------------------------------------
-- Atomic domain writer updated for the new authoritative fields/entity.
-- SECURITY INVOKER: owner RLS continues to apply.
-- ---------------------------------------------------------------------------

create or replace function public.apply_domain_transaction(ops jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
  kind text;
  row jsonb;
begin
  if ops is null then return; end if;

  for item in select value from jsonb_array_elements(ops)
  loop
    kind := item->>'op';
    row := item->'row';

    if kind = 'upsert_canvas' then
      insert into public.canvases as c (
        id, owner_id, primary_frame_id, name, viewport_x, viewport_y,
        viewport_zoom, created_at, updated_at, last_opened_at
      ) values (
        (row->>'id')::uuid, (row->>'owner_id')::uuid,
        (row->>'primary_frame_id')::uuid, row->>'name',
        (row->>'viewport_x')::double precision,
        (row->>'viewport_y')::double precision,
        (row->>'viewport_zoom')::double precision,
        (row->>'created_at')::timestamptz,
        (row->>'updated_at')::timestamptz,
        nullif(row->>'last_opened_at', '')::timestamptz
      ) on conflict (id) do update set
        primary_frame_id = excluded.primary_frame_id,
        name = excluded.name,
        viewport_x = excluded.viewport_x,
        viewport_y = excluded.viewport_y,
        viewport_zoom = excluded.viewport_zoom,
        updated_at = excluded.updated_at,
        last_opened_at = excluded.last_opened_at;

    elsif kind = 'upsert_frame' then
      insert into public.frames as f (
        id, canvas_id, name, x, y, width, height, z_index, created_at, updated_at
      ) values (
        (row->>'id')::uuid, (row->>'canvas_id')::uuid,
        nullif(row->>'name', ''), (row->>'x')::double precision,
        (row->>'y')::double precision, (row->>'width')::double precision,
        (row->>'height')::double precision, nullif(row->>'z_index', '')::integer,
        (row->>'created_at')::timestamptz, (row->>'updated_at')::timestamptz
      ) on conflict (id) do update set
        name = excluded.name, x = excluded.x, y = excluded.y,
        width = excluded.width, height = excluded.height,
        z_index = excluded.z_index, updated_at = excluded.updated_at;

    elsif kind = 'upsert_column' then
      insert into public.columns as col (
        id, canvas_id, frame_id, name, x, y, width, height,
        z_index, created_at, updated_at
      ) values (
        (row->>'id')::uuid, (row->>'canvas_id')::uuid,
        (row->>'frame_id')::uuid, row->>'name',
        (row->>'x')::double precision, (row->>'y')::double precision,
        (row->>'width')::double precision, (row->>'height')::double precision,
        nullif(row->>'z_index', '')::integer,
        (row->>'created_at')::timestamptz, (row->>'updated_at')::timestamptz
      ) on conflict (id) do update set
        name = excluded.name, x = excluded.x, y = excluded.y,
        width = excluded.width, height = excluded.height,
        z_index = excluded.z_index, updated_at = excluded.updated_at;

    elsif kind = 'upsert_card' then
      insert into public.cards as c (
        id, canvas_id, frame_id, column_id, type, payload, x, y, width,
        height, z_index, created_at, updated_at
      ) values (
        (row->>'id')::uuid, (row->>'canvas_id')::uuid,
        nullif(row->>'frame_id', '')::uuid,
        nullif(row->>'column_id', '')::uuid,
        row->>'type', coalesce(row->'payload', '{}'::jsonb),
        (row->>'x')::double precision, (row->>'y')::double precision,
        (row->>'width')::double precision, (row->>'height')::double precision,
        nullif(row->>'z_index', '')::integer,
        (row->>'created_at')::timestamptz, (row->>'updated_at')::timestamptz
      ) on conflict (id) do update set
        frame_id = excluded.frame_id, column_id = excluded.column_id,
        type = excluded.type, payload = excluded.payload,
        x = excluded.x, y = excluded.y, width = excluded.width,
        height = excluded.height, z_index = excluded.z_index,
        updated_at = excluded.updated_at;

    elsif kind = 'upsert_watch_bot' then
      insert into public.watch_bots as w (
        id, owner_id, canvas_id, column_id, name, instruction, status,
        source_types, last_error, last_activity_at, next_run_at,
        created_at, updated_at
      ) values (
        (row->>'id')::uuid, (row->>'owner_id')::uuid,
        (row->>'canvas_id')::uuid, (row->>'column_id')::uuid,
        nullif(row->>'name', ''), row->>'instruction', row->>'status',
        coalesce(
          (select array_agg(value) from jsonb_array_elements_text(row->'source_types')),
          '{}'::text[]
        ),
        nullif(row->>'last_error', ''),
        nullif(row->>'last_activity_at', '')::timestamptz,
        nullif(row->>'next_run_at', '')::timestamptz,
        (row->>'created_at')::timestamptz, (row->>'updated_at')::timestamptz
      ) on conflict (id) do update set
        column_id = excluded.column_id, name = excluded.name,
        instruction = excluded.instruction, status = excluded.status,
        source_types = excluded.source_types, last_error = excluded.last_error,
        last_activity_at = excluded.last_activity_at,
        next_run_at = excluded.next_run_at, updated_at = excluded.updated_at;

    elsif kind = 'insert_watch_bot_event' then
      insert into public.watch_bot_events (
        id, watch_bot_id, canvas_id, kind, source_url, dedup_key,
        novelty_score, discovered_at, title, published_at, source_type,
        card_id, detail
      ) values (
        (row->>'id')::uuid, (row->>'watch_bot_id')::uuid,
        (row->>'canvas_id')::uuid, row->>'kind', row->>'source_url',
        row->>'dedup_key', nullif(row->>'novelty_score', '')::double precision,
        (row->>'discovered_at')::timestamptz, nullif(row->>'title', ''),
        nullif(row->>'published_at', '')::timestamptz,
        nullif(row->>'source_type', ''), nullif(row->>'card_id', '')::uuid,
        nullif(row->>'detail', '')
      );
    else
      raise exception 'unknown domain op %', kind;
    end if;
  end loop;
end;
$$;

revoke all on function public.apply_domain_transaction(jsonb) from public, anon;
grant execute on function public.apply_domain_transaction(jsonb) to authenticated;
