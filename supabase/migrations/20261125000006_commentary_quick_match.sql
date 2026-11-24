-- Phase 1: live commentary feed and standalone quick matches.

-- ----------------------------------------------------------------------------
-- Quick matches are stored as a one-match tournament of kind QUICK.
-- ----------------------------------------------------------------------------
alter table public.tournaments
  add column kind text not null default 'TOURNAMENT' check (kind in ('TOURNAMENT', 'QUICK'));

create or replace function public.tournaments_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_reserved_slug(new.slug) then
    raise exception 'SLUG_RESERVED';
  end if;
  if exists (select 1 from public.slug_redirects
              where old_slug = new.slug and tournament_id <> new.id) then
    raise exception 'SLUG_TAKEN';
  end if;
  if tg_op = 'INSERT' then
    if new.kind = 'TOURNAMENT' and (select count(*) from public.tournaments
                                     where owner_id = new.owner_id and kind = 'TOURNAMENT') >= 50 then
      raise exception 'LIMIT_TOURNAMENTS';
    end if;
    if new.kind = 'QUICK' and (select count(*) from public.tournaments
                                where owner_id = new.owner_id and kind = 'QUICK') >= 200 then
      raise exception 'LIMIT_QUICK_MATCHES';
    end if;
  else
    if new.owner_id <> old.owner_id then
      raise exception 'OWNER_IMMUTABLE';
    end if;
    if new.kind <> old.kind then
      raise exception 'KIND_IMMUTABLE';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;

-- Creates the tournament, category, players, entries and match in one step.
-- Side B second player null = singles.
create or replace function public.create_quick_match(
  p_a1 text, p_b1 text, p_a2 text default null, p_b2 text default null,
  p_preset text default 'BWF_21'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_dbl   boolean := nullif(btrim(coalesce(p_a2, '')), '') is not null;
  v_tid   uuid;
  v_cat   uuid;
  v_slug  text;
  v_pa1 uuid; v_pa2 uuid; v_pb1 uuid; v_pb2 uuid;
  v_ea uuid; v_eb uuid; v_mid uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_preset not in ('BWF_21','BAI_15','QUICK_21','SHORT_15') then raise exception 'BAD_REQUEST'; end if;
  if v_dbl <> (nullif(btrim(coalesce(p_b2, '')), '') is not null) then
    raise exception 'DOUBLES_TAKES_TWO_PLAYERS';
  end if;

  v_slug := 'm-' || substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 12);

  insert into public.tournaments (owner_id, kind, name, slug, start_date, end_date, status, visibility)
  values (v_uid, 'QUICK',
          left(btrim(p_a1) || coalesce(' / ' || nullif(btrim(p_a2), ''), '') || ' v ' ||
               btrim(p_b1) || coalesce(' / ' || nullif(btrim(p_b2), ''), ''), 120),
          v_slug, current_date, current_date, 'PUBLISHED', 'UNLISTED')
  returning id into v_tid;

  insert into public.categories (tournament_id, name, kind, rule_preset)
  values (v_tid, case when v_dbl then 'Doubles' else 'Singles' end,
          case when v_dbl then 'DOUBLES' else 'SINGLES' end, p_preset)
  returning id into v_cat;

  insert into public.players (tournament_id, name) values (v_tid, btrim(p_a1)) returning id into v_pa1;
  insert into public.players (tournament_id, name) values (v_tid, btrim(p_b1)) returning id into v_pb1;
  if v_dbl then
    insert into public.players (tournament_id, name) values (v_tid, btrim(p_a2)) returning id into v_pa2;
    insert into public.players (tournament_id, name) values (v_tid, btrim(p_b2)) returning id into v_pb2;
  end if;

  insert into public.entries (tournament_id, category_id, player1_id, player2_id)
  values (v_tid, v_cat, v_pa1, v_pa2) returning id into v_ea;
  insert into public.entries (tournament_id, category_id, player1_id, player2_id)
  values (v_tid, v_cat, v_pb1, v_pb2) returning id into v_eb;

  insert into public.matches (tournament_id, category_id, entry_a_id, entry_b_id)
  values (v_tid, v_cat, v_ea, v_eb) returning id into v_mid;

  return jsonb_build_object('tournament_id', v_tid, 'match_id', v_mid, 'slug', v_slug);
end $$;

revoke execute on function public.create_quick_match(text, text, text, text, text) from public, anon;
grant execute on function public.create_quick_match(text, text, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Commentary: public-safe facts from the private match log.
-- Undone events (and the undo events themselves) are left out.
-- ----------------------------------------------------------------------------
create or replace function public.match_commentary(p_match_id uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'seq', e.seq,
           'command', e.command,
           'side', e.side,
           'reason', e.reason,
           'at', e.created_at,
           'game', (e.state_before->>'current_game')::int,
           'a', (e.state_before->>'score_a')::int,
           'b', (e.state_before->>'score_b')::int,
           'ga', (e.state_before->>'games_won_a')::int,
           'gb', (e.state_before->>'games_won_b')::int,
           'status', e.state_before->>'status'
         ) order by e.seq), '[]'::jsonb)
    from public.match_events e
    join public.matches m on m.id = e.match_id
   where e.match_id = p_match_id
     and private.tournament_is_visible(m.tournament_id)
     and e.command <> 'UNDO'
     and not exists (select 1 from public.match_events u
                      where u.match_id = e.match_id and u.command = 'UNDO' and u.target_event_id = e.id);
$$;

revoke execute on function public.match_commentary(uuid) from public;
grant execute on function public.match_commentary(uuid) to anon, authenticated;
