-- Phase 1 checks: commentary, quick matches, colours, organizations. Rolls back.
-- Usage: docker exec -i <db container> psql -U postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/p1_features_test.sql
\set QUIET on
begin;

create schema t_;
create function t_.expect_error(q text, pat text) returns void language plpgsql as $$
begin
  begin execute q;
  exception when others then
    if sqlerrm !~* pat then raise exception 'Expected "%", got "%" for: %', pat, sqlerrm, q; end if;
    return;
  end;
  raise exception 'Expected error "%" but it succeeded: %', pat, q;
end $$;
create function t_.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;
create function t_.cmd(mid uuid, c text, side text default null) returns jsonb language plpgsql as $$
declare v int;
begin
  select version into v from public.matches where id = mid;
  return public.apply_match_command(mid, c, v, gen_random_uuid(), side, null);
end $$;
create function t_.as_user(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'email', email)::text, true);
$$;
grant usage on schema t_ to anon, authenticated;
grant execute on all functions in schema t_ to anon, authenticated;

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'helper@example.com', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'outsider@example.com', 'authenticated', 'authenticated');

-- ── Quick match and commentary ─────────────────────────────────────────────
set local role authenticated;
select t_.as_user('11111111-1111-1111-1111-111111111111', 'owner@example.com');

select public.create_quick_match('Aman', 'Rahul') ->> 'match_id' as qm \gset
select t_.ok((select t.kind = 'QUICK' and t.status = 'PUBLISHED' and t.visibility = 'UNLISTED'
                from public.tournaments t join public.matches m on m.tournament_id = t.id where m.id = :'qm'),
             'quick match is a published, unlisted one-match event');
select t_.expect_error($$select public.create_quick_match('A', 'B', 'C', null)$$, 'DOUBLES_TAKES_TWO_PLAYERS');
select t_.ok(true, 'quick doubles needs four players');

select t_.cmd(:'qm', 'START', 'A');
select t_.cmd(:'qm', 'POINT', 'A');
select t_.cmd(:'qm', 'POINT', 'B');
select t_.cmd(:'qm', 'POINT', 'B');
select t_.cmd(:'qm', 'UNDO');
select t_.ok(jsonb_array_length(public.match_commentary(:'qm')) = 3, 'commentary lists start and 2 rallies, not the undone one');
select t_.ok((select bool_and(x ->> 'command' <> 'UNDO') from jsonb_array_elements(public.match_commentary(:'qm')) x), 'undo events are not in commentary');

update public.tournaments set brand_primary = '#1d4ed8', brand_accent = '#f59e0b'
 where id = (select tournament_id from public.matches where id = :'qm');
select t_.ok(true, 'valid colours are saved');
select t_.expect_error(format($$update public.tournaments set brand_primary = 'red' where id = (select tournament_id from public.matches where id = %L)$$, :'qm'), 'check constraint');
select t_.expect_error(format($$update public.tournaments set brand_accent = '#ABCDEF' where id = (select tournament_id from public.matches where id = %L)$$, :'qm'), 'check constraint');
select t_.ok(true, 'malformed or uppercase colours are rejected');

-- Draft commentary is private.
insert into public.tournaments (name, slug, start_date, end_date) values ('Draft cup', 'draft-cup', '2026-12-01', '2026-12-01') returning id as dt \gset
insert into public.categories (tournament_id, name, kind) values (:'dt', 'Singles', 'SINGLES') returning id as dc \gset
insert into public.players (tournament_id, name) values (:'dt', 'P1') returning id as p1 \gset
insert into public.players (tournament_id, name) values (:'dt', 'P2') returning id as p2 \gset
insert into public.entries (tournament_id, category_id, player1_id) values (:'dt', :'dc', :'p1') returning id as e1 \gset
insert into public.entries (tournament_id, category_id, player1_id) values (:'dt', :'dc', :'p2') returning id as e2 \gset
insert into public.matches (tournament_id, category_id, entry_a_id, entry_b_id) values (:'dt', :'dc', :'e1', :'e2') returning id as dm \gset
select t_.cmd(:'dm', 'START', 'A');
select t_.cmd(:'dm', 'POINT', 'A');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select t_.ok(jsonb_array_length(public.match_commentary(:'qm')) = 3, 'public can read commentary of a published match');
select t_.ok(jsonb_array_length(public.match_commentary(:'dm')) = 0, 'draft commentary is hidden from the public');
select t_.expect_error($$select public.create_quick_match('A', 'B')$$, 'permission denied');
select t_.ok(true, 'anonymous visitors cannot create quick matches');
select t_.expect_error($$select count(*) from public.match_events$$, 'permission denied');
select t_.ok(true, 'raw match log stays private');

-- ── Organizations ──────────────────────────────────────────────────────────
reset role;
set local role authenticated;
select t_.as_user('11111111-1111-1111-1111-111111111111', 'owner@example.com');
insert into public.organizations (name) values ('Riverside Badminton Club') returning id as org \gset
select t_.ok((select role = 'OWNER' and email = 'owner@example.com' from public.organization_members where organization_id = :'org'), 'creator becomes OWNER');
update public.tournaments set organization_id = :'org' where id = :'dt';
insert into public.organization_invites (organization_id, email) values (:'org', 'Helper@Example.com') returning token as tok \gset
select t_.ok((select email = 'helper@example.com' and role = 'ORGANIZER' from public.organization_invites where token = :'tok'), 'invite email is normalised, default role ORGANIZER');
select t_.expect_error($$delete from public.organization_members where role = 'OWNER'$$, 'LAST_OWNER');
select t_.ok(true, 'the last owner cannot leave');

-- Outsider: can't see the org, its draft tournament, or use someone else's invite.
reset role;
set local role authenticated;
select t_.as_user('33333333-3333-3333-3333-333333333333', 'outsider@example.com');
select t_.ok((select count(*) = 0 from public.organizations where id = :'org'), 'outsider cannot see a private organization');
select t_.ok((select count(*) = 0 from public.organization_invites), 'outsider cannot list invites');
select t_.ok((public.invite_preview(:'tok') ->> 'email_matches')::boolean = false, 'invite preview says the email does not match');
select t_.ok(public.invite_preview(:'tok') ->> 'email_hint' = 'he•••@example.com', 'invite preview masks the email');
select t_.expect_error(format($$select public.accept_invite(%L)$$, :'tok'), 'INVITE_WRONG_EMAIL');
select t_.ok(true, 'an invite only works for the invited email');
insert into public.tournaments (name, slug, start_date, end_date) values ('Outsider cup', 'outsider-cup', '2026-12-01', '2026-12-01') returning id as ot \gset
select t_.expect_error(format($$update public.tournaments set organization_id = %L where id = %L$$, :'org', :'ot'), 'NOT_ORG_MEMBER');
select t_.ok(true, 'cannot move a tournament into an organization you are not in');
select t_.expect_error(format($$select t_.cmd(%L, 'POINT', 'A')$$, :'dm'), 'NOT_FOUND');
select t_.ok(true, 'outsider cannot score an organization match');

-- Invited helper accepts and becomes an ORGANIZER.
reset role;
set local role authenticated;
select t_.as_user('22222222-2222-2222-2222-222222222222', 'helper@example.com');
select t_.ok(public.accept_invite(:'tok') = :'org'::uuid, 'invited email accepts the invite');
select t_.expect_error(format($$select public.accept_invite(%L)$$, :'tok'), 'INVITE_USED');
select t_.ok(true, 'an invite works only once');
select t_.ok((select role = 'ORGANIZER' from public.organization_members where user_id = '22222222-2222-2222-2222-222222222222'), 'helper is an ORGANIZER');
select t_.ok((select count(*) = 1 from public.tournaments where id = :'dt'), 'organizer can see the organization draft');
select t_.cmd(:'dm', 'POINT', 'B');
select t_.ok((select score_b = 1 from public.matches where id = :'dm'), 'organizer can score organization matches');
update public.tournaments set name = 'Draft cup renamed' where id = :'dt';
select t_.ok((select name = 'Draft cup renamed' from public.tournaments where id = :'dt'), 'organizer can edit organization tournaments');
delete from public.tournaments where id = :'dt';
select t_.ok((select count(*) = 1 from public.tournaments where id = :'dt'), 'organizer cannot delete organization tournaments');
select t_.expect_error(format($$insert into public.organization_invites (organization_id, email) values (%L, 'x@example.com')$$, :'org'), 'row-level security');
select t_.ok(true, 'organizers cannot invite people');
select t_.ok((select count(*) = 0 from public.organization_invites), 'organizers cannot read invite tokens');
update public.organization_members set role = 'OWNER' where user_id = '22222222-2222-2222-2222-222222222222';
select t_.ok((select role = 'ORGANIZER' from public.organization_members where user_id = '22222222-2222-2222-2222-222222222222'), 'organizers cannot promote themselves');
select t_.ok(public.tournament_bundle(:'dt') ->> 'can_manage' = 'true', 'bundle reports can_manage for organizers');
delete from public.organization_members where user_id = '22222222-2222-2222-2222-222222222222';
select t_.ok((select count(*) = 0 from public.tournaments where id = :'dt'), 'after leaving, the organization draft is hidden again');

-- Organization becomes public once it has a published tournament.
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select t_.ok((select count(*) = 0 from public.organizations), 'organization hidden while it has no published tournament');
select t_.expect_error($$select count(*) from public.organization_members$$, 'permission denied');
select t_.ok(true, 'public cannot read members');

reset role;
set local role authenticated;
select t_.as_user('11111111-1111-1111-1111-111111111111', 'owner@example.com');
update public.tournaments set status = 'PUBLISHED' where id = :'dt';
delete from public.tournaments where id = :'dt';
select t_.ok((select count(*) = 0 from public.tournaments where id = :'dt'), 'creator can delete an organization tournament');

reset role;
rollback;
\echo ALL PHASE 1 CHECKS PASSED
