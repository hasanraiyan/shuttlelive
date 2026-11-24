-- Phase 0 security and scoring checks. Runs in one transaction and rolls back.
-- Usage (local stack):  docker exec -i <db container> psql -U postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/p0_core_test.sql
\set QUIET on
begin;

create schema t_;
create function t_.expect_error(q text, pat text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if sqlerrm !~* pat then raise exception 'Expected error matching "%", got "%" for: %', pat, sqlerrm, q; end if;
    return;
  end;
  raise exception 'Expected error "%" but statement succeeded: %', pat, q;
end $$;
create function t_.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;
create function t_.cmd(mid uuid, c text, side text default null, reason text default null) returns jsonb language plpgsql as $$
declare v int;
begin
  select version into v from public.matches where id = mid;
  return public.apply_match_command(mid, c, v, gen_random_uuid(), side, reason);
end $$;
create function t_.points(mid uuid, side text, n int) returns void language plpgsql as $$
begin
  for i in 1..n loop perform t_.cmd(mid, 'POINT', side); end loop;
end $$;
create function t_.alternate(mid uuid, n int) returns void language plpgsql as $$
begin
  for i in 1..n loop perform t_.cmd(mid, 'POINT', 'A'); perform t_.cmd(mid, 'POINT', 'B'); end loop;
end $$;
grant usage on schema t_ to anon, authenticated;
grant execute on all functions in schema t_ to anon, authenticated;

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.com', 'authenticated', 'authenticated');

-- ── Owner sets up a tournament ─────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select t_.expect_error($$insert into public.tournaments (name, slug, start_date, end_date) values ('Admin cup', 'admin', '2026-12-01', '2026-12-02')$$, 'SLUG_RESERVED');
select t_.ok(true, 'TC-23 reserved slug blocked');

insert into public.tournaments (name, slug, start_date, end_date)
values ('Winter Open', 'winter-open', '2026-12-01', '2026-12-02') returning id as tid \gset
insert into public.courts (tournament_id, name) values (:'tid', 'Court 1') returning id as c1 \gset
insert into public.courts (tournament_id, name) values (:'tid', 'Court 2') returning id as c2 \gset
insert into public.categories (tournament_id, name, kind, rule_preset) values (:'tid', 'Men''s singles', 'SINGLES', 'BWF_21') returning id as cat \gset
insert into public.categories (tournament_id, name, kind, rule_preset) values (:'tid', 'Short format', 'SINGLES', 'BAI_15') returning id as cat15 \gset

insert into public.players (tournament_id, name)
select :'tid', 'Player ' || g from generate_series(1, 10) g;
insert into public.entries (tournament_id, category_id, player1_id, seed)
select :'tid', :'cat', id, row_number() over (order by name) from public.players where tournament_id = :'tid';

select t_.expect_error(format($$insert into public.entries (tournament_id, category_id, player1_id) select %L, %L, id from public.players where tournament_id = %L limit 1$$, :'tid', :'cat', :'tid'), 'PLAYER_ALREADY_ENTERED');
select t_.ok(true, 'player cannot be entered twice in one category');

select t_.expect_error($$update public.matches set score_a = 5$$, 'permission denied');
select t_.ok(true, 'owner cannot write score columns directly');

select public.generate_knockout(:'cat') as created \gset
select t_.ok(:created = 15, 'TC-15 16-slot bracket has 15 matches');
select t_.ok((select count(*) = 6 from public.matches where category_id = :'cat' and result_reason = 'BYE'), 'TC-15 exactly 6 byes');
select t_.ok((select count(*) = 6 from public.matches m join public.entries e on e.id in (m.entry_a_id, m.entry_b_id)
               where m.category_id = :'cat' and m.round = 2 and e.seed <= 6), 'byes go to seeds 1-6 and advance to round 2');

-- ── Scoring a round-one match ──────────────────────────────────────────────
select id as m1 from public.matches where category_id = :'cat' and round = 1 and entry_a_id is not null and entry_b_id is not null order by position limit 1 \gset
update public.matches set court_id = :'c1' where id = :'m1';
select t_.cmd(:'m1', 'START', 'A');
select t_.points(:'m1', 'A', 20);
select t_.points(:'m1', 'B', 20);
select t_.cmd(:'m1', 'POINT', 'A');
select t_.ok((select status = 'LIVE' and score_a = 21 and score_b = 20 from public.matches where id = :'m1'), 'TC-02 21-20 does not win the game');
select t_.cmd(:'m1', 'POINT', 'A');
select t_.ok((select status = 'GAME_ENDED' and games_won_a = 1 and serving_side = 'A' from public.matches where id = :'m1'), 'TC-03 22-20 wins game 1');

select t_.cmd(:'m1', 'NEXT_GAME');
select t_.ok((select status = 'LIVE' and current_game = 2 and score_a = 0 and serving_side = 'A' from public.matches where id = :'m1'), 'TC-06 game winner serves first in game 2');
select t_.cmd(:'m1', 'UNDO');
select t_.ok((select status = 'GAME_ENDED' and current_game = 1 and score_a = 22 from public.matches where id = :'m1'), 'undo of next game returns to end of game 1');
select t_.cmd(:'m1', 'UNDO');
select t_.ok((select status = 'LIVE' and score_a = 21 and score_b = 20 and games_won_a = 0 from public.matches where id = :'m1'), 'TC-07 undo of game-winning point reopens the game');
select t_.ok((select winner_side is null from public.match_games where match_id = :'m1' and game_number = 1), 'TC-07 game winner cleared on undo');

-- Idempotency
select version as v1 from public.matches where id = :'m1' \gset
select public.apply_match_command(:'m1', 'POINT', :v1, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'B');
select public.apply_match_command(:'m1', 'POINT', :v1, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'B') ->> 'duplicate' as dup \gset
select t_.ok(:'dup' = 'true' and (select score_b = 21 from public.matches where id = :'m1'), 'TC-09 duplicate client event is not counted twice');
select t_.expect_error(format($$select public.apply_match_command(%L, 'POINT', 1, gen_random_uuid(), 'A')$$, :'m1'), 'VERSION_CONFLICT');
select t_.ok(true, 'stale version is rejected');

-- Cap at 30: 21-21 → 29-29 → 30-29
select t_.alternate(:'m1', 8);
select t_.ok((select score_a = 29 and score_b = 29 and status = 'LIVE' from public.matches where id = :'m1'), '29 all still live');
select t_.cmd(:'m1', 'POINT', 'A');
select t_.ok((select status = 'GAME_ENDED' and score_a = 30 from public.matches where id = :'m1'), 'TC-04 30-29 ends the game at the cap');

-- Win the match, undo from pending, confirm, winner advances
select t_.cmd(:'m1', 'NEXT_GAME');
select t_.points(:'m1', 'A', 21);
select t_.ok((select status = 'MATCH_WON_PENDING' and winner_side = 'A' from public.matches where id = :'m1'), 'match won goes to pending confirmation');
select t_.cmd(:'m1', 'UNDO');
select t_.ok((select status = 'LIVE' and score_a = 20 and games_won_a = 1 and winner_side is null from public.matches where id = :'m1'), 'TC-08 undo from pending returns to live');
select t_.cmd(:'m1', 'POINT', 'A');
select t_.cmd(:'m1', 'CONFIRM');
select t_.ok((select status = 'FINALIZED' from public.matches where id = :'m1'), 'result confirmed');
select t_.ok((select (n.entry_a_id = m.entry_a_id or n.entry_b_id = m.entry_a_id) from public.matches m join public.matches n on n.id = m.next_match_id where m.id = :'m1'), 'TC-16 winner advances to next round');
select t_.expect_error(format($$select t_.cmd(%L, 'UNDO')$$, :'m1'), 'BAD_STATE');
select t_.ok(true, 'confirmed results cannot be undone');

-- Court and player clashes
select id as m2 from public.matches where category_id = :'cat' and round = 1 and status = 'SCHEDULED' and entry_a_id is not null and entry_b_id is not null order by position limit 1 \gset
insert into public.matches (tournament_id, category_id, entry_a_id, entry_b_id)
values (:'tid', :'cat',
        (select id from public.entries where category_id = :'cat' and seed = 1),
        (select id from public.entries where category_id = :'cat' and seed = 2)) returning id as m3 \gset
update public.matches set court_id = :'c2' where id in (:'m2', :'m3');
select t_.cmd(:'m2', 'START', 'B');
select t_.expect_error(format($$select t_.cmd(%L, 'START', 'A')$$, :'m3'), 'COURT_BUSY');
select t_.ok(true, 'TC-17 second match cannot start on an occupied court');

insert into public.matches (tournament_id, category_id, entry_a_id, entry_b_id, court_id)
select :'tid', :'cat', entry_a_id, (select entry_a_id from public.matches where id = :'m3'), :'c1' from public.matches where id = :'m2' returning id as clash \gset
select t_.expect_error(format($$select t_.cmd(%L, 'START', 'A')$$, :'clash'), 'PLAYER_BUSY');
select t_.ok(true, 'TC-18 player already on court cannot start another match');

-- Walkover
select t_.cmd(:'m3', 'TERMINATE', 'B', 'WALKOVER');
select t_.ok((select status = 'TERMINATED' and result_reason = 'WALKOVER' and score_a = 0 and score_b = 0 from public.matches where id = :'m3'), 'TC-19 walkover recorded with no invented score');
select t_.ok((select count(*) = 0 from public.match_games where match_id = :'m3'), 'TC-19 walkover creates no game scores');

-- BAI 15 format cap at 21
insert into public.players (tournament_id, name) values (:'tid', 'Short A') returning id as sa \gset
insert into public.players (tournament_id, name) values (:'tid', 'Short B') returning id as sb \gset
insert into public.entries (tournament_id, category_id, player1_id) values (:'tid', :'cat15', :'sa') returning id as ea \gset
insert into public.entries (tournament_id, category_id, player1_id) values (:'tid', :'cat15', :'sb') returning id as eb \gset
insert into public.matches (tournament_id, category_id, entry_a_id, entry_b_id) values (:'tid', :'cat15', :'ea', :'eb') returning id as m15 \gset
select t_.cmd(:'m15', 'START', 'A');
select t_.points(:'m15', 'A', 14);
select t_.points(:'m15', 'B', 14);
select t_.cmd(:'m15', 'POINT', 'A');
select t_.ok((select status = 'LIVE' from public.matches where id = :'m15'), '15-14 is not a win in BAI 15');
select t_.points(:'m15', 'B', 1);
select t_.alternate(:'m15', 5);
select t_.cmd(:'m15', 'POINT', 'B');
select t_.ok((select status = 'GAME_ENDED' and score_b = 21 and score_a = 20 from public.matches where id = :'m15'), 'TC-05 BAI 15 ends at the 21 cap');

-- Immutable log
select t_.expect_error(format($$update public.match_events set side = 'B' where match_id = %L$$, :'m1'), 'permission denied');
select t_.expect_error(format($$delete from public.match_events where match_id = %L$$, :'m1'), 'permission denied');
select t_.ok(true, 'match log cannot be edited or deleted');
select t_.expect_error(format($$insert into public.match_games (match_id, tournament_id, game_number) values (%L, %L, 4)$$, :'m1', :'tid'), 'permission denied');
select t_.ok(true, 'game scores cannot be written directly');

select t_.ok(private.owns_tournament_path(:'tid' || '/logo-1.png'), 'owner may write to own media folder');
select t_.ok(not private.owns_tournament_path('../etc/passwd'), 'malformed storage path rejected');
select t_.ok(jsonb_array_length(public.tournament_bundle(:'tid')->'matches') > 0, 'owner bundle includes matches');

-- ── Anonymous visitor ──────────────────────────────────────────────────────
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select t_.ok((select count(*) = 0 from public.tournaments), 'TC-14 draft tournaments are hidden from the public');
select t_.ok((select count(*) = 0 from public.matches), 'draft matches are hidden from the public');
select t_.ok(public.tournament_bundle(:'tid') is null and public.tournament_bundle_by_slug('winter-open') is null, 'bundle hides drafts from the public');
select t_.expect_error(format($$select public.apply_match_command(%L, 'POINT', 1, gen_random_uuid(), 'A')$$, :'m2'), 'permission denied');
select t_.ok(true, 'TC-12 anonymous callers cannot score');
select t_.expect_error(format($$insert into public.players (tournament_id, name) values (%L, 'x')$$, :'tid'), 'permission denied');
select t_.ok(true, 'anonymous callers cannot write');

-- ── A different organizer ──────────────────────────────────────────────────
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
update public.tournaments set name = 'Hijacked' where id = :'tid';
select t_.ok((select count(*) = 0 from public.tournaments where id = :'tid'), 'other organizer cannot see a draft');
select t_.ok(public.tournament_bundle(:'tid') is null, 'other organizer gets no bundle for a draft');
select t_.expect_error(format($$select public.apply_match_command(%L, 'POINT', 1, gen_random_uuid(), 'A')$$, :'m2'), 'NOT_FOUND');
select t_.ok(true, 'TC-25 other organizer cannot score');
select t_.expect_error(format($$select public.generate_knockout(%L)$$, :'cat'), 'NOT_FOUND');
select t_.ok(not private.owns_tournament_path(:'tid' || '/logo-1.png'), 'other organizer cannot write to the media folder');
select t_.expect_error(format($$insert into public.players (tournament_id, name) values (%L, 'x')$$, :'tid'), 'row-level security');
select t_.ok(true, 'other organizer cannot add players');

-- ── Publish, slug change, public read ──────────────────────────────────────
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select t_.ok((select name = 'Winter Open' from public.tournaments where id = :'tid'), 'hijack attempt changed nothing');
select t_.expect_error(format($$update public.tournaments set owner_id = '22222222-2222-2222-2222-222222222222' where id = %L$$, :'tid'), 'permission denied');
select t_.ok(true, 'owner cannot be reassigned by clients');
update public.tournaments set status = 'PUBLISHED' where id = :'tid';
update public.tournaments set slug = 'winter-open-2026' where id = :'tid';
select t_.ok((select count(*) = 1 from public.slug_redirects where old_slug = 'winter-open' and tournament_id = :'tid'), 'TC-24 old slug is kept as a redirect');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select t_.expect_error($$insert into public.tournaments (name, slug, start_date, end_date) values ('Copy', 'winter-open', '2026-12-01', '2026-12-01')$$, 'SLUG_TAKEN');
select t_.ok(true, 'redirected slug cannot be taken by someone else');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select t_.ok((select count(*) = 1 from public.tournaments where slug = 'winter-open-2026'), 'published tournament is public');
select t_.ok((select count(*) > 0 from public.matches where tournament_id = :'tid'), 'published matches are public');
select t_.ok(public.tournament_bundle_by_slug('winter-open-2026')->'tournament'->>'slug' = 'winter-open-2026', 'public bundle by slug');
select t_.ok(public.tournament_bundle_by_slug('winter-open')->>'redirect' = 'winter-open-2026', 'old slug returns a redirect');
select t_.expect_error($$select count(*) from public.match_events$$, 'permission denied');
select t_.ok(true, 'match log is not public');

reset role;
rollback;
\echo ALL CHECKS PASSED
