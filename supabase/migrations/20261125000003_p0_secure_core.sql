-- ============================================================================
-- ShuttleLive · Phase 0 secure core (SRS v1.3)
--
-- Replaces the schema created by migrations 000000–000002. Those migrations
-- left several tables without RLS, exposed SECURITY DEFINER scoring functions
-- to anonymous callers, and let any signed-in user overwrite any stored file.
-- The production database held no rows when this migration was written.
--
-- Model: one role. The signed-in owner of a tournament is the only account
-- that can change it, including scoring. Everyone can read tournaments that
-- are not in DRAFT.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Remove the previous schema
-- ----------------------------------------------------------------------------
drop function if exists public.record_point_event(uuid, varchar, varchar, int, uuid);
drop function if exists public.undo_point_event(uuid, varchar, uuid);
drop function if exists public.start_match(uuid, varchar, uuid);
drop function if exists public.start_next_game(uuid, varchar, uuid);
drop function if exists public.finalize_match(uuid, uuid);
drop function if exists public.terminate_match(uuid, uuid, varchar, uuid);

drop table if exists
  public.match_assignments, public.match_events, public.match_games, public.matches,
  public.entry_members, public.entries, public.players, public.teams,
  public.category_rounds, public.categories, public.courts, public.slug_redirects,
  public.tournament_sponsors, public.tournament_members, public.tournament_branding,
  public.tournaments, public.organization_members, public.organizations
  cascade;

drop policy if exists "Public Read All Assets" on storage.objects;
drop policy if exists "Authenticated Users Upload Assets" on storage.objects;
drop policy if exists "Authenticated Users Update Assets" on storage.objects;
-- Old buckets stay (they are empty) but become private with no policies.
-- pg_trgm (from migration 000000) is unused in Phase 0 and should not live in public.
drop extension if exists pg_trgm;

update storage.buckets set public = false
 where id in ('tournament-assets', 'organization-assets', 'player-avatars');

-- ----------------------------------------------------------------------------
-- 1. Pure helpers
-- ----------------------------------------------------------------------------
create or replace function public.is_reserved_slug(p_slug text)
returns boolean language sql immutable set search_path = '' as $$
  select p_slug = any (array[
    'admin','api','app','auth','login','logout','sign-in','sign-up','signin','signup',
    'dashboard','tournaments','tournament','explore','settings','pricing','help','live',
    'new','about','terms','privacy','support','static','www','t','m','score'
  ]);
$$;

create or replace function public.rules_for_preset(p_preset text)
returns jsonb language sql immutable set search_path = '' as $$
  select case p_preset
    when 'BWF_21'   then '{"best_of":3,"points":21,"cap":30,"interval_at":11}'::jsonb
    when 'BAI_15'   then '{"best_of":3,"points":15,"cap":21,"interval_at":8}'::jsonb
    when 'QUICK_21' then '{"best_of":1,"points":21,"cap":30,"interval_at":11}'::jsonb
    when 'SHORT_15' then '{"best_of":1,"points":15,"cap":21,"interval_at":8}'::jsonb
  end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------
create table public.tournaments (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 3 and 120),
  slug          text not null unique
                check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$' and slug !~ '--'),
  subtitle      text check (char_length(subtitle) <= 160),
  description   text check (char_length(description) <= 4000),
  host_name     text check (char_length(host_name) <= 120),
  venue_name    text check (char_length(venue_name) <= 160),
  venue_address text check (char_length(venue_address) <= 300),
  venue_map_url text check (venue_map_url ~ '^https://[^\s<>"]{1,500}$'),
  start_date    date not null,
  end_date      date not null,
  status        text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','COMPLETED')),
  visibility    text not null default 'PUBLIC' check (visibility in ('PUBLIC','UNLISTED')),
  logo_path     text,
  banner_path   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (end_date >= start_date and end_date <= start_date + 60),
  check (logo_path   ~ ('^' || id::text || '/[a-z0-9._-]{1,100}$')),
  check (banner_path ~ ('^' || id::text || '/[a-z0-9._-]{1,100}$'))
);
create index tournaments_owner_idx on public.tournaments (owner_id);

create table public.slug_redirects (
  old_slug      text primary key,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  created_at    timestamptz not null default now()
);
create index slug_redirects_tournament_idx on public.slug_redirects (tournament_id);

create table public.courts (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 40),
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now(),
  unique (tournament_id, name),
  unique (id, tournament_id)
);

create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 2 and 60),
  kind          text not null check (kind in ('SINGLES','DOUBLES')),
  rule_preset   text not null default 'BWF_21' check (rule_preset in ('BWF_21','BAI_15','QUICK_21','SHORT_15')),
  created_at    timestamptz not null default now(),
  unique (tournament_id, name),
  unique (id, tournament_id)
);

create table public.players (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 80),
  club          text check (char_length(club) <= 80),
  created_at    timestamptz not null default now(),
  unique (id, tournament_id)
);
create index players_tournament_idx on public.players (tournament_id);

create table public.entries (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null,
  category_id   uuid not null,
  player1_id    uuid not null,
  player2_id    uuid,
  seed          int check (seed between 1 and 128),
  display_name  text not null default '',
  created_at    timestamptz not null default now(),
  foreign key (category_id, tournament_id) references public.categories(id, tournament_id) on delete cascade,
  foreign key (player1_id, tournament_id)  references public.players(id, tournament_id) on delete cascade,
  foreign key (player2_id, tournament_id)  references public.players(id, tournament_id) on delete cascade,
  unique (id, category_id)
);
create index entries_category_idx on public.entries (category_id);
create index entries_tournament_idx on public.entries (tournament_id);

create table public.matches (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null,
  category_id     uuid not null,
  round           int  not null default 1 check (round between 1 and 8),
  position        int  check (position >= 1),
  court_id        uuid,
  entry_a_id      uuid,
  entry_b_id      uuid,
  next_match_id   uuid references public.matches(id) on delete set null,
  next_slot       text check (next_slot in ('A','B')),
  status          text not null default 'SCHEDULED'
                  check (status in ('SCHEDULED','LIVE','GAME_ENDED','MATCH_WON_PENDING','FINALIZED','TERMINATED')),
  result_reason   text check (result_reason in ('NORMAL','WALKOVER','RETIREMENT','DISQUALIFICATION','BYE')),
  rules           jsonb not null default '{}'::jsonb,
  current_game    int  not null default 1,
  serving_side    text check (serving_side in ('A','B')),
  score_a         int  not null default 0,
  score_b         int  not null default 0,
  games_won_a     int  not null default 0,
  games_won_b     int  not null default 0,
  winner_side     text check (winner_side in ('A','B')),
  version         int  not null default 1,
  scheduled_at    timestamptz,
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (category_id, tournament_id) references public.categories(id, tournament_id) on delete cascade,
  foreign key (court_id, tournament_id)    references public.courts(id, tournament_id) on delete set null (court_id),
  foreign key (entry_a_id, category_id)    references public.entries(id, category_id),
  foreign key (entry_b_id, category_id)    references public.entries(id, category_id)
);
create index matches_tournament_idx on public.matches (tournament_id);
create index matches_category_idx on public.matches (category_id, round, position);
create index matches_court_active_idx on public.matches (court_id) where status in ('LIVE','GAME_ENDED','MATCH_WON_PENDING');
create index matches_entry_a_idx on public.matches (entry_a_id);
create index matches_entry_b_idx on public.matches (entry_b_id);
create index matches_next_idx on public.matches (next_match_id);

create table public.match_games (
  match_id      uuid not null references public.matches(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  game_number   int  not null check (game_number between 1 and 5),
  score_a       int  not null default 0,
  score_b       int  not null default 0,
  winner_side   text check (winner_side in ('A','B')),
  primary key (match_id, game_number)
);
create index match_games_tournament_idx on public.match_games (tournament_id);

-- Append-only log. No client can update or delete rows.
create table public.match_events (
  id              bigint generated always as identity primary key,
  match_id        uuid not null references public.matches(id) on delete cascade,
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  seq             int  not null,
  command         text not null check (command in ('START','POINT','UNDO','NEXT_GAME','CONFIRM','TERMINATE')),
  side            text check (side in ('A','B')),
  reason          text,
  target_event_id bigint references public.match_events(id),
  state_before    jsonb not null,
  client_event_id uuid not null,
  created_by      uuid default auth.uid() references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (match_id, seq),
  unique (match_id, client_event_id)
);
create index match_events_tournament_idx on public.match_events (tournament_id);
create index match_events_target_idx on public.match_events (target_event_id);

-- ----------------------------------------------------------------------------
-- 3. Access helpers (used by RLS policies)
-- ----------------------------------------------------------------------------
create or replace function public.owns_tournament(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tournaments
     where id = p_tournament_id and owner_id = (select auth.uid())
  );
$$;

create or replace function public.tournament_is_visible(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tournaments
     where id = p_tournament_id
       and (status <> 'DRAFT' or owner_id = (select auth.uid()))
  );
$$;

-- Storage object names look like "<tournament uuid>/<file>".
create or replace function public.owns_tournament_path(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_folder text := split_part(p_name, '/', 1);
begin
  if v_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.owns_tournament(v_folder::uuid);
end $$;

-- ----------------------------------------------------------------------------
-- 4. Integrity triggers
-- ----------------------------------------------------------------------------

-- Slugs: reserved words, redirect bookkeeping, owner immutability, quotas.
create or replace function public.tournaments_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_reserved_slug(new.slug) then
    raise exception 'SLUG_RESERVED';
  end if;

  if exists (select 1 from public.slug_redirects
              where old_slug = new.slug and tournament_id <> new.id) then
    raise exception 'SLUG_TAKEN';
  end if;

  if tg_op = 'INSERT' then
    if (select count(*) from public.tournaments where owner_id = new.owner_id) >= 50 then
      raise exception 'LIMIT_TOURNAMENTS';
    end if;
  else
    if new.owner_id <> old.owner_id then
      raise exception 'OWNER_IMMUTABLE';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;

create or replace function public.tournaments_after_slug_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.slug is distinct from old.slug then
    -- Reclaiming an old slug of this same tournament removes its redirect.
    delete from public.slug_redirects where old_slug = new.slug;
    -- Only remember slugs that were ever public.
    if old.status <> 'DRAFT' then
      insert into public.slug_redirects (old_slug, tournament_id)
      values (old.slug, new.id)
      on conflict (old_slug) do update set tournament_id = excluded.tournament_id;
    end if;
  end if;
  return null;
end $$;

create trigger tournaments_before_write
  before insert or update on public.tournaments
  for each row execute function public.tournaments_before_write();
create trigger tournaments_after_slug_change
  after update of slug on public.tournaments
  for each row execute function public.tournaments_after_slug_change();

-- Per-tournament quotas (abuse protection).
create or replace function public.enforce_child_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
  v_limit int;
begin
  case tg_table_name
    when 'players'    then select count(*) into v_count from public.players    where tournament_id = new.tournament_id; v_limit := 1000;
    when 'courts'     then select count(*) into v_count from public.courts     where tournament_id = new.tournament_id; v_limit := 30;
    when 'categories' then select count(*) into v_count from public.categories where tournament_id = new.tournament_id; v_limit := 20;
    when 'entries'    then select count(*) into v_count from public.entries    where category_id   = new.category_id;   v_limit := 128;
    when 'matches'    then select count(*) into v_count from public.matches    where tournament_id = new.tournament_id; v_limit := 2000;
  end case;
  if v_count >= v_limit then
    raise exception 'LIMIT_%', upper(tg_table_name);
  end if;
  return new;
end $$;

create trigger players_quota    before insert on public.players    for each row execute function public.enforce_child_quota();
create trigger courts_quota     before insert on public.courts     for each row execute function public.enforce_child_quota();
create trigger categories_quota before insert on public.categories for each row execute function public.enforce_child_quota();
create trigger entries_quota    before insert on public.entries    for each row execute function public.enforce_child_quota();
create trigger matches_quota    before insert on public.matches    for each row execute function public.enforce_child_quota();

-- Changing a category's format or rules after its draw exists would desync matches.
create or replace function public.categories_before_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.kind <> old.kind or new.rule_preset <> old.rule_preset)
     and exists (select 1 from public.matches where category_id = old.id) then
    raise exception 'CATEGORY_HAS_MATCHES';
  end if;
  return new;
end $$;
create trigger categories_before_update
  before update on public.categories
  for each row execute function public.categories_before_update();

-- Entries: singles/doubles shape, one entry per player per category, display name.
create or replace function public.entries_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_kind text;
  v_n1 text;
  v_n2 text;
begin
  select kind into v_kind from public.categories where id = new.category_id;

  if v_kind = 'SINGLES' and new.player2_id is not null then
    raise exception 'SINGLES_TAKES_ONE_PLAYER';
  end if;
  if v_kind = 'DOUBLES' and (new.player2_id is null or new.player2_id = new.player1_id) then
    raise exception 'DOUBLES_TAKES_TWO_PLAYERS';
  end if;

  if exists (
    select 1 from public.entries e
     where e.category_id = new.category_id and e.id <> new.id
       and (e.player1_id in (new.player1_id, new.player2_id)
            or e.player2_id in (new.player1_id, new.player2_id))
  ) then
    raise exception 'PLAYER_ALREADY_ENTERED';
  end if;

  select name into v_n1 from public.players where id = new.player1_id;
  if new.player2_id is not null then
    select name into v_n2 from public.players where id = new.player2_id;
  end if;
  new.display_name := v_n1 || coalesce(' / ' || v_n2, '');
  return new;
end $$;
create trigger entries_before_write
  before insert or update on public.entries
  for each row execute function public.entries_before_write();

-- Keep entry names in step when a player is renamed.
create or replace function public.players_after_rename()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.name is distinct from old.name then
    update public.entries set display_name = display_name
     where player1_id = new.id or player2_id = new.id;
  end if;
  return null;
end $$;
create trigger players_after_rename
  after update of name on public.players
  for each row execute function public.players_after_rename();

-- Matches: rules snapshot, no self-match, entries frozen once play starts.
create or replace function public.matches_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_preset text;
begin
  if new.entry_a_id is not null and new.entry_a_id = new.entry_b_id then
    raise exception 'SAME_ENTRY_TWICE';
  end if;

  if tg_op = 'INSERT' then
    select rule_preset into v_preset from public.categories where id = new.category_id;
    new.rules := public.rules_for_preset(v_preset);
  else
    if (new.entry_a_id is distinct from old.entry_a_id or new.entry_b_id is distinct from old.entry_b_id)
       and old.status <> 'SCHEDULED' then
      raise exception 'MATCH_ALREADY_STARTED';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger matches_before_write
  before insert or update on public.matches
  for each row execute function public.matches_before_write();

-- ----------------------------------------------------------------------------
-- 5. Row-level security
-- ----------------------------------------------------------------------------
alter table public.tournaments    enable row level security;
alter table public.slug_redirects enable row level security;
alter table public.courts         enable row level security;
alter table public.categories     enable row level security;
alter table public.players        enable row level security;
alter table public.entries        enable row level security;
alter table public.matches        enable row level security;
alter table public.match_games    enable row level security;
alter table public.match_events   enable row level security;

-- Tournaments
create policy "read published or own tournaments" on public.tournaments
  for select to anon, authenticated
  using (status <> 'DRAFT' or owner_id = (select auth.uid()));
create policy "owner creates tournaments" on public.tournaments
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner updates tournaments" on public.tournaments
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner deletes tournaments" on public.tournaments
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Slug redirects: readable for visible tournaments, written only by triggers.
create policy "read redirects of visible tournaments" on public.slug_redirects
  for select to anon, authenticated using (public.tournament_is_visible(tournament_id));

-- Child tables: read if the tournament is visible, write only as its owner.
create policy "read courts"   on public.courts     for select to anon, authenticated using (public.tournament_is_visible(tournament_id));
create policy "owner inserts courts" on public.courts for insert to authenticated with check (public.owns_tournament(tournament_id));
create policy "owner updates courts" on public.courts for update to authenticated using (public.owns_tournament(tournament_id)) with check (public.owns_tournament(tournament_id));
create policy "owner deletes courts" on public.courts for delete to authenticated using (public.owns_tournament(tournament_id));

create policy "read categories"  on public.categories for select to anon, authenticated using (public.tournament_is_visible(tournament_id));
create policy "owner inserts categories" on public.categories for insert to authenticated with check (public.owns_tournament(tournament_id));
create policy "owner updates categories" on public.categories for update to authenticated using (public.owns_tournament(tournament_id)) with check (public.owns_tournament(tournament_id));
create policy "owner deletes categories" on public.categories for delete to authenticated using (public.owns_tournament(tournament_id));

create policy "read players"  on public.players for select to anon, authenticated using (public.tournament_is_visible(tournament_id));
create policy "owner inserts players" on public.players for insert to authenticated with check (public.owns_tournament(tournament_id));
create policy "owner updates players" on public.players for update to authenticated using (public.owns_tournament(tournament_id)) with check (public.owns_tournament(tournament_id));
create policy "owner deletes players" on public.players for delete to authenticated using (public.owns_tournament(tournament_id));

create policy "read entries"  on public.entries for select to anon, authenticated using (public.tournament_is_visible(tournament_id));
create policy "owner inserts entries" on public.entries for insert to authenticated with check (public.owns_tournament(tournament_id));
create policy "owner updates entries" on public.entries for update to authenticated using (public.owns_tournament(tournament_id)) with check (public.owns_tournament(tournament_id));
create policy "owner deletes entries" on public.entries for delete to authenticated using (public.owns_tournament(tournament_id));

create policy "read matches" on public.matches for select to anon, authenticated using (public.tournament_is_visible(tournament_id));
create policy "owner inserts matches" on public.matches for insert to authenticated with check (public.owns_tournament(tournament_id));
create policy "owner updates matches" on public.matches for update to authenticated
  using (public.owns_tournament(tournament_id)) with check (public.owns_tournament(tournament_id));
create policy "owner deletes unplayed matches" on public.matches for delete to authenticated
  using (public.owns_tournament(tournament_id) and status = 'SCHEDULED');

create policy "read match games"  on public.match_games  for select to anon, authenticated using (public.tournament_is_visible(tournament_id));
create policy "owner reads match log" on public.match_events for select to authenticated using (public.owns_tournament(tournament_id));

-- ----------------------------------------------------------------------------
-- 6. Table and column privileges (defence in depth on top of RLS)
-- ----------------------------------------------------------------------------
revoke all on public.tournaments, public.slug_redirects, public.courts, public.categories,
              public.players, public.entries, public.matches, public.match_games, public.match_events
  from anon, authenticated;

grant select on public.tournaments, public.slug_redirects, public.courts, public.categories,
                public.players, public.entries, public.matches, public.match_games
  to anon, authenticated;
grant select on public.match_events to authenticated;

grant insert (name, slug, subtitle, description, host_name, venue_name, venue_address, venue_map_url,
              start_date, end_date, visibility)
  on public.tournaments to authenticated;
grant update (name, slug, subtitle, description, host_name, venue_name, venue_address, venue_map_url,
              start_date, end_date, status, visibility, logo_path, banner_path)
  on public.tournaments to authenticated;
grant delete on public.tournaments to authenticated;

grant insert (tournament_id, name, sort_order), update (name, sort_order), delete on public.courts to authenticated;
grant insert (tournament_id, name, kind, rule_preset), update (name, kind, rule_preset), delete on public.categories to authenticated;
grant insert (tournament_id, name, club), update (name, club), delete on public.players to authenticated;
grant insert (tournament_id, category_id, player1_id, player2_id, seed), update (seed), delete on public.entries to authenticated;
grant insert (tournament_id, category_id, round, position, court_id, entry_a_id, entry_b_id, scheduled_at),
      update (court_id, entry_a_id, entry_b_id, scheduled_at),
      delete
  on public.matches to authenticated;
-- match_games and match_events: no client writes at all.

-- ----------------------------------------------------------------------------
-- 7. Scoring engine (single entry point, owner-checked)
-- ----------------------------------------------------------------------------
create or replace function public.match_state(p_match_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select to_jsonb(m) || jsonb_build_object('games', coalesce((
           select jsonb_agg(jsonb_build_object(
                    'game_number', g.game_number, 'score_a', g.score_a,
                    'score_b', g.score_b, 'winner_side', g.winner_side)
                  order by g.game_number)
             from public.match_games g where g.match_id = m.id), '[]'::jsonb))
    from public.matches m where m.id = p_match_id;
$$;

create or replace function public.advance_winner(p_match public.matches, p_winner_side text)
returns void language plpgsql set search_path = '' as $$
declare
  v_entry uuid := case p_winner_side when 'A' then p_match.entry_a_id else p_match.entry_b_id end;
  v_status text;
begin
  if p_match.next_match_id is null or v_entry is null then
    return;
  end if;
  select status into v_status from public.matches where id = p_match.next_match_id for update;
  if v_status <> 'SCHEDULED' then
    raise exception 'NEXT_MATCH_ALREADY_STARTED';
  end if;
  if p_match.next_slot = 'A' then
    update public.matches set entry_a_id = v_entry where id = p_match.next_match_id;
  else
    update public.matches set entry_b_id = v_entry where id = p_match.next_match_id;
  end if;
end $$;

create or replace function public.apply_match_command(
  p_match_id         uuid,
  p_command          text,
  p_expected_version int,
  p_client_event_id  uuid,
  p_side             text default null,
  p_reason           text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m         public.matches%rowtype;
  v_uid     uuid := (select auth.uid());
  v_seq     int;
  v_state   jsonb;
  v_points  int;
  v_cap     int;
  v_best    int;
  v_a       int;
  v_b       int;
  v_mine    int;
  v_theirs  int;
  v_wa      int;
  v_wb      int;
  v_target  public.match_events%rowtype;
  v_snap    jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_client_event_id is null or p_command is null then
    raise exception 'BAD_REQUEST';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found or not public.owns_tournament(m.tournament_id) then
    raise exception 'NOT_FOUND';
  end if;

  -- Idempotent replay: the same client event never applies twice.
  if exists (select 1 from public.match_events
              where match_id = m.id and client_event_id = p_client_event_id) then
    return public.match_state(m.id) || jsonb_build_object('duplicate', true);
  end if;

  if p_expected_version is distinct from m.version then
    raise exception 'VERSION_CONFLICT';
  end if;

  if p_side is not null and p_side not in ('A','B') then
    raise exception 'BAD_REQUEST';
  end if;

  v_seq := m.version + 1;
  v_state := jsonb_build_object(
    'status', m.status, 'current_game', m.current_game, 'serving_side', m.serving_side,
    'score_a', m.score_a, 'score_b', m.score_b,
    'games_won_a', m.games_won_a, 'games_won_b', m.games_won_b, 'winner_side', m.winner_side,
    'games', coalesce((
      select jsonb_agg(jsonb_build_object(
               'game_number', g.game_number, 'score_a', g.score_a,
               'score_b', g.score_b, 'winner_side', g.winner_side) order by g.game_number)
        from public.match_games g where g.match_id = m.id), '[]'::jsonb));

  v_points := (m.rules->>'points')::int;
  v_cap    := (m.rules->>'cap')::int;
  v_best   := (m.rules->>'best_of')::int;

  case upper(p_command)

  -- START: first server chosen; court and players must be free.
  when 'START' then
    if m.status <> 'SCHEDULED' then raise exception 'BAD_STATE'; end if;
    if m.entry_a_id is null or m.entry_b_id is null then raise exception 'ENTRIES_MISSING'; end if;
    if p_side is null then raise exception 'BAD_REQUEST'; end if;

    if m.court_id is not null and exists (
      select 1 from public.matches o
       where o.court_id = m.court_id and o.id <> m.id
         and o.status in ('LIVE','GAME_ENDED','MATCH_WON_PENDING')) then
      raise exception 'COURT_BUSY';
    end if;

    if exists (
      with mine as (
        select player1_id p from public.entries where id in (m.entry_a_id, m.entry_b_id)
        union select player2_id from public.entries where id in (m.entry_a_id, m.entry_b_id) and player2_id is not null
      )
      select 1
        from public.matches o
        join public.entries e on e.id in (o.entry_a_id, o.entry_b_id)
       where o.tournament_id = m.tournament_id and o.id <> m.id
         and o.status in ('LIVE','GAME_ENDED','MATCH_WON_PENDING')
         and (e.player1_id in (select p from mine) or e.player2_id in (select p from mine))) then
      raise exception 'PLAYER_BUSY';
    end if;

    insert into public.match_games (match_id, tournament_id, game_number)
    values (m.id, m.tournament_id, 1);

    update public.matches
       set status = 'LIVE', current_game = 1, serving_side = p_side,
           score_a = 0, score_b = 0, games_won_a = 0, games_won_b = 0,
           started_at = now(), version = v_seq
     where id = m.id;

  -- POINT: rally won by p_side. The rally winner serves next.
  when 'POINT' then
    if m.status <> 'LIVE' then raise exception 'BAD_STATE'; end if;
    if p_side is null then raise exception 'BAD_REQUEST'; end if;

    v_a := m.score_a + case when p_side = 'A' then 1 else 0 end;
    v_b := m.score_b + case when p_side = 'B' then 1 else 0 end;
    v_mine   := case when p_side = 'A' then v_a else v_b end;
    v_theirs := case when p_side = 'A' then v_b else v_a end;
    v_wa := m.games_won_a;
    v_wb := m.games_won_b;

    if (v_mine >= v_points and v_mine - v_theirs >= 2) or v_mine >= v_cap then
      if p_side = 'A' then v_wa := v_wa + 1; else v_wb := v_wb + 1; end if;
      update public.match_games set score_a = v_a, score_b = v_b, winner_side = p_side
       where match_id = m.id and game_number = m.current_game;
      update public.matches
         set score_a = v_a, score_b = v_b, games_won_a = v_wa, games_won_b = v_wb,
             serving_side = p_side,
             status = case when greatest(v_wa, v_wb) >= v_best / 2 + 1 then 'MATCH_WON_PENDING' else 'GAME_ENDED' end,
             winner_side = case when greatest(v_wa, v_wb) >= v_best / 2 + 1 then p_side end,
             version = v_seq
       where id = m.id;
    else
      update public.match_games set score_a = v_a, score_b = v_b
       where match_id = m.id and game_number = m.current_game;
      update public.matches
         set score_a = v_a, score_b = v_b, serving_side = p_side, version = v_seq
       where id = m.id;
    end if;

  -- NEXT_GAME: the previous game's winner serves first.
  when 'NEXT_GAME' then
    if m.status <> 'GAME_ENDED' then raise exception 'BAD_STATE'; end if;
    insert into public.match_games (match_id, tournament_id, game_number)
    values (m.id, m.tournament_id, m.current_game + 1);
    update public.matches
       set status = 'LIVE', current_game = m.current_game + 1, score_a = 0, score_b = 0, version = v_seq
     where id = m.id;

  -- UNDO: restore the state saved before the latest un-undone POINT or NEXT_GAME.
  when 'UNDO' then
    if m.status not in ('LIVE','GAME_ENDED','MATCH_WON_PENDING') then raise exception 'BAD_STATE'; end if;

    select e.* into v_target
      from public.match_events e
     where e.match_id = m.id and e.command in ('POINT','NEXT_GAME')
       and not exists (select 1 from public.match_events u
                        where u.match_id = m.id and u.command = 'UNDO' and u.target_event_id = e.id)
     order by e.seq desc
     limit 1;
    if not found then raise exception 'NOTHING_TO_UNDO'; end if;

    v_snap := v_target.state_before;
    delete from public.match_games where match_id = m.id;
    insert into public.match_games (match_id, tournament_id, game_number, score_a, score_b, winner_side)
    select m.id, m.tournament_id, (g->>'game_number')::int, (g->>'score_a')::int, (g->>'score_b')::int, g->>'winner_side'
      from jsonb_array_elements(v_snap->'games') g;

    update public.matches
       set status       = v_snap->>'status',
           current_game = (v_snap->>'current_game')::int,
           serving_side = v_snap->>'serving_side',
           score_a      = (v_snap->>'score_a')::int,
           score_b      = (v_snap->>'score_b')::int,
           games_won_a  = (v_snap->>'games_won_a')::int,
           games_won_b  = (v_snap->>'games_won_b')::int,
           winner_side  = v_snap->>'winner_side',
           version      = v_seq
     where id = m.id;

  -- CONFIRM: lock the result and send the winner to the next round.
  when 'CONFIRM' then
    if m.status <> 'MATCH_WON_PENDING' then raise exception 'BAD_STATE'; end if;
    update public.matches
       set status = 'FINALIZED', result_reason = 'NORMAL', finished_at = now(), version = v_seq
     where id = m.id;
    perform public.advance_winner(m, m.winner_side);

  -- TERMINATE: walkover (before play), retirement (during play), disqualification.
  when 'TERMINATE' then
    if p_side is null or p_reason not in ('WALKOVER','RETIREMENT','DISQUALIFICATION') then
      raise exception 'BAD_REQUEST';
    end if;
    if m.entry_a_id is null or m.entry_b_id is null then raise exception 'ENTRIES_MISSING'; end if;
    if p_reason = 'WALKOVER' and m.status <> 'SCHEDULED' then raise exception 'BAD_STATE'; end if;
    if p_reason = 'RETIREMENT' and m.status not in ('LIVE','GAME_ENDED') then raise exception 'BAD_STATE'; end if;
    if m.status not in ('SCHEDULED','LIVE','GAME_ENDED') then raise exception 'BAD_STATE'; end if;

    update public.matches
       set status = 'TERMINATED', result_reason = p_reason, winner_side = p_side,
           finished_at = now(), version = v_seq
     where id = m.id;
    perform public.advance_winner(m, p_side);

  else
    raise exception 'BAD_REQUEST';
  end case;

  insert into public.match_events
    (match_id, tournament_id, seq, command, side, reason, target_event_id, state_before, client_event_id, created_by)
  values
    (m.id, m.tournament_id, v_seq, upper(p_command), p_side, p_reason,
     case when upper(p_command) = 'UNDO' then v_target.id end,
     v_state, p_client_event_id, v_uid);

  return public.match_state(m.id);
end $$;

-- ----------------------------------------------------------------------------
-- 8. Knockout draw generator (standard seeding, byes to top seeds)
-- ----------------------------------------------------------------------------
create or replace function public.generate_knockout(p_category_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  c        public.categories%rowtype;
  v_ent    uuid[];
  v_n      int;
  v_size   int := 2;
  v_rounds int := 1;
  v_order  int[] := array[1];
  v_next   int[];
  v_len    int;
  x        int;
  r        int;
  p        int;
  v_sa     int;
  v_sb     int;
  v_created int := 0;
  bye      public.matches%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into c from public.categories where id = p_category_id;
  if not found or not public.owns_tournament(c.tournament_id) then
    raise exception 'NOT_FOUND';
  end if;

  if exists (select 1 from public.matches
              where category_id = c.id
                and status <> 'SCHEDULED'
                and coalesce(result_reason, '') <> 'BYE') then
    raise exception 'DRAW_LOCKED';
  end if;

  delete from public.matches where category_id = c.id;

  select array_agg(id order by seed nulls last, created_at, id) into v_ent
    from public.entries where category_id = c.id;
  v_n := coalesce(array_length(v_ent, 1), 0);
  if v_n < 2 then raise exception 'NOT_ENOUGH_ENTRIES'; end if;

  while v_size < v_n loop
    v_size := v_size * 2;
    v_rounds := v_rounds + 1;
  end loop;

  -- Seed order, e.g. size 8 -> 1,8,4,5,2,7,3,6
  while array_length(v_order, 1) < v_size loop
    v_len := array_length(v_order, 1);
    v_next := '{}';
    foreach x in array v_order loop
      v_next := v_next || x || (2 * v_len + 1 - x);
    end loop;
    v_order := v_next;
  end loop;

  for r in 1..v_rounds loop
    for p in 1..(v_size / (2 ^ r)::int) loop
      if r = 1 then
        v_sa := v_order[2 * p - 1];
        v_sb := v_order[2 * p];
        insert into public.matches (tournament_id, category_id, round, position, entry_a_id, entry_b_id)
        values (c.tournament_id, c.id, 1, p,
                case when v_sa <= v_n then v_ent[v_sa] end,
                case when v_sb <= v_n then v_ent[v_sb] end);
      else
        insert into public.matches (tournament_id, category_id, round, position)
        values (c.tournament_id, c.id, r, p);
      end if;
      v_created := v_created + 1;
    end loop;
  end loop;

  update public.matches m
     set next_match_id = nm.id,
         next_slot = case when m.position % 2 = 1 then 'A' else 'B' end
    from public.matches nm
   where m.category_id = c.id and nm.category_id = c.id
     and nm.round = m.round + 1 and nm.position = (m.position + 1) / 2;

  -- Byes: a first-round match with one entry is decided immediately.
  for bye in
    select * from public.matches
     where category_id = c.id and round = 1
       and (entry_a_id is null) <> (entry_b_id is null)
  loop
    update public.matches
       set status = 'FINALIZED', result_reason = 'BYE',
           winner_side = case when bye.entry_a_id is not null then 'A' else 'B' end,
           finished_at = now()
     where id = bye.id;
    perform public.advance_winner(bye, case when bye.entry_a_id is not null then 'A' else 'B' end);
  end loop;

  return v_created;
end $$;

-- Removes a category's draw while nothing has been played (byes don't count).
create or replace function public.clear_knockout(p_category_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_tid uuid;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select tournament_id into v_tid from public.categories where id = p_category_id;
  if v_tid is null or not public.owns_tournament(v_tid) then raise exception 'NOT_FOUND'; end if;
  if exists (select 1 from public.matches
              where category_id = p_category_id and status <> 'SCHEDULED'
                and coalesce(result_reason, '') <> 'BYE') then
    raise exception 'DRAW_LOCKED';
  end if;
  delete from public.matches where category_id = p_category_id;
end $$;

-- ----------------------------------------------------------------------------
-- 9. Function privileges
-- ----------------------------------------------------------------------------
revoke execute on function
  public.match_state(uuid),
  public.advance_winner(public.matches, text),
  public.apply_match_command(uuid, text, int, uuid, text, text),
  public.generate_knockout(uuid),
  public.clear_knockout(uuid),
  public.tournaments_before_write(),
  public.tournaments_after_slug_change(),
  public.enforce_child_quota(),
  public.categories_before_update(),
  public.entries_before_write(),
  public.players_after_rename(),
  public.matches_before_write()
  from public, anon, authenticated;

grant execute on function public.apply_match_command(uuid, text, int, uuid, text, text) to authenticated;
grant execute on function public.generate_knockout(uuid) to authenticated;
grant execute on function public.clear_knockout(uuid) to authenticated;

-- Used inside RLS policies, so both roles need them. They only return booleans.
revoke execute on function public.owns_tournament(uuid), public.tournament_is_visible(uuid),
  public.owns_tournament_path(text) from public;
grant execute on function public.owns_tournament(uuid), public.tournament_is_visible(uuid),
  public.owns_tournament_path(text) to anon, authenticated;
grant execute on function public.is_reserved_slug(text), public.rules_for_preset(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 10. Realtime (RLS applies to subscribers)
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.matches, public.match_games;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 11. Storage: one public bucket, owner-only writes under "<tournament id>/"
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tournament-media', 'tournament-media', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No public SELECT policy: files are served from the public URL, but the
-- bucket cannot be listed. Owners can see their own files.
create policy "owner reads tournament media" on storage.objects
  for select to authenticated
  using (bucket_id = 'tournament-media' and public.owns_tournament_path(name));
create policy "owner uploads tournament media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tournament-media' and public.owns_tournament_path(name));
create policy "owner updates tournament media" on storage.objects
  for update to authenticated
  using (bucket_id = 'tournament-media' and public.owns_tournament_path(name))
  with check (bucket_id = 'tournament-media' and public.owns_tournament_path(name));
create policy "owner deletes tournament media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'tournament-media' and public.owns_tournament_path(name));
