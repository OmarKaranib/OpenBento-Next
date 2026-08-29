-- Additive Phase 3 persist contract.
-- Do NOT apply this migration to a hosted or production database from an agent.
-- Platform applies reviewed SQL to the explicit-dev project only.
--
-- 1. Same-canvas composite FK on watch_bot_events.card_id.
-- 2. Invoker transaction helper so createCard + setCardFrame +
--    unique claim cannot leave an orphan Card.

-- ---------------------------------------------------------------------------
-- Same-canvas card_id (idempotent if init already defined it)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'watch_bot_events_card_same_canvas_fkey'
  ) then
    alter table public.watch_bot_events
      add constraint watch_bot_events_card_same_canvas_fkey
      foreign key (card_id, canvas_id)
      references public.cards (id, canvas_id);
  end if;
end
$$;

comment on constraint watch_bot_events_card_same_canvas_fkey on public.watch_bot_events is
  'Prevents watch_bot_events.card_id from referencing a card on another canvas. MATCH SIMPLE so a null card_id is allowed.';

-- ---------------------------------------------------------------------------
-- Atomic domain writes (leftover-Card TOCTOU)
-- SECURITY INVOKER — RLS still applies. Not security definer.
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
  if ops is null then
    return;
  end if;

  for item in select value from jsonb_array_elements(ops)
  loop
    kind := item->>'op';
    row := item->'row';

    if kind = 'upsert_canvas' then
      insert into public.canvases as c (
        id, owner_id, name, viewport_x, viewport_y, viewport_zoom,
        created_at, updated_at, last_opened_at
      ) values (
        (row->>'id')::uuid,
        (row->>'owner_id')::uuid,
        row->>'name',
        (row->>'viewport_x')::double precision,
        (row->>'viewport_y')::double precision,
        (row->>'viewport_zoom')::double precision,
        (row->>'created_at')::timestamptz,
        (row->>'updated_at')::timestamptz,
        nullif(row->>'last_opened_at', '')::timestamptz
      )
      on conflict (id) do update set
        name = excluded.name,
        viewport_x = excluded.viewport_x,
        viewport_y = excluded.viewport_y,
        viewport_zoom = excluded.viewport_zoom,
        updated_at = excluded.updated_at,
        last_opened_at = excluded.last_opened_at;

    elsif kind = 'upsert_card' then
      insert into public.cards as c (
        id, canvas_id, frame_id, type, payload, x, y, width, height,
        z_index, created_at, updated_at
      ) values (
        (row->>'id')::uuid,
        (row->>'canvas_id')::uuid,
        nullif(row->>'frame_id', '')::uuid,
        row->>'type',
        coalesce(row->'payload', '{}'::jsonb),
        (row->>'x')::double precision,
        (row->>'y')::double precision,
        (row->>'width')::double precision,
        (row->>'height')::double precision,
        nullif(row->>'z_index', '')::integer,
        (row->>'created_at')::timestamptz,
        (row->>'updated_at')::timestamptz
      )
      on conflict (id) do update set
        frame_id = excluded.frame_id,
        type = excluded.type,
        payload = excluded.payload,
        x = excluded.x,
        y = excluded.y,
        width = excluded.width,
        height = excluded.height,
        z_index = excluded.z_index,
        updated_at = excluded.updated_at;

    elsif kind = 'upsert_frame' then
      insert into public.frames as f (
        id, canvas_id, name, x, y, width, height, z_index, created_at, updated_at
      ) values (
        (row->>'id')::uuid,
        (row->>'canvas_id')::uuid,
        nullif(row->>'name', ''),
        (row->>'x')::double precision,
        (row->>'y')::double precision,
        (row->>'width')::double precision,
        (row->>'height')::double precision,
        nullif(row->>'z_index', '')::integer,
        (row->>'created_at')::timestamptz,
        (row->>'updated_at')::timestamptz
      )
      on conflict (id) do update set
        name = excluded.name,
        x = excluded.x,
        y = excluded.y,
        width = excluded.width,
        height = excluded.height,
        z_index = excluded.z_index,
        updated_at = excluded.updated_at;

    elsif kind = 'upsert_watch_bot' then
      insert into public.watch_bots as w (
        id, owner_id, canvas_id, name, instruction, status, source_types,
        last_error, last_activity_at, next_run_at, created_at, updated_at
      ) values (
        (row->>'id')::uuid,
        (row->>'owner_id')::uuid,
        (row->>'canvas_id')::uuid,
        nullif(row->>'name', ''),
        row->>'instruction',
        row->>'status',
        coalesce(
          (select array_agg(value) from jsonb_array_elements_text(row->'source_types')),
          '{}'::text[]
        ),
        nullif(row->>'last_error', ''),
        nullif(row->>'last_activity_at', '')::timestamptz,
        nullif(row->>'next_run_at', '')::timestamptz,
        (row->>'created_at')::timestamptz,
        (row->>'updated_at')::timestamptz
      )
      on conflict (id) do update set
        name = excluded.name,
        instruction = excluded.instruction,
        status = excluded.status,
        source_types = excluded.source_types,
        last_error = excluded.last_error,
        last_activity_at = excluded.last_activity_at,
        next_run_at = excluded.next_run_at,
        updated_at = excluded.updated_at;

    elsif kind = 'insert_watch_bot_event' then
      insert into public.watch_bot_events (
        id, watch_bot_id, canvas_id, kind, source_url, dedup_key,
        novelty_score, discovered_at, title, published_at, source_type,
        card_id, detail
      ) values (
        (row->>'id')::uuid,
        (row->>'watch_bot_id')::uuid,
        (row->>'canvas_id')::uuid,
        row->>'kind',
        row->>'source_url',
        row->>'dedup_key',
        nullif(row->>'novelty_score', '')::double precision,
        (row->>'discovered_at')::timestamptz,
        nullif(row->>'title', ''),
        nullif(row->>'published_at', '')::timestamptz,
        nullif(row->>'source_type', ''),
        nullif(row->>'card_id', '')::uuid,
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

comment on function public.apply_domain_transaction(jsonb) is
  'SECURITY INVOKER batch write for leftover-Card TOCTOU. Unique conflict rolls back the Card. RLS still applies.';
