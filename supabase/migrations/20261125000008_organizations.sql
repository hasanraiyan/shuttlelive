-- Phase 1: organization workspaces.
--
-- An organization is a shared workspace. Members are OWNER (manage members,
-- invites, the organization itself) or ORGANIZER (run the organization's
-- tournaments). A tournament may belong to one organization; then its owner
-- and every member of that organization can manage it.
--
-- private.owns_tournament() is redefined as "can manage", so every existing
-- RLS policy, scoring function and storage rule picks up the new rule.

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 120),
  logo_path   text,
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (logo_path ~ ('^orgs/' || id::text || '/[a-z0-9._-]{1,100}$'))
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null check (role in ('OWNER', 'ORGANIZER')),
  email           text check (char_length(email) <= 320),
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

create table public.organization_invites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           text not null check (email ~ '^[^@\s]{1,64}@[^@\s]{1,255}$' and email = lower(email)),
  role            text not null default 'ORGANIZER' check (role in ('OWNER', 'ORGANIZER')),
  token           text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  invited_by      uuid default auth.uid() references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '7 days',
  accepted_at     timestamptz,
  accepted_by     uuid references auth.users(id) on delete set null
);
create index organization_invites_org_idx on public.organization_invites (organization_id);

alter table public.tournaments
  add column organization_id uuid references public.organizations(id) on delete set null;
create index tournaments_org_idx on public.tournaments (organization_id);

-- ----------------------------------------------------------------------------
-- Helpers (private schema: not reachable through the API)
-- ----------------------------------------------------------------------------
create or replace function private.org_role(p_org uuid)
returns text language sql stable security definer set search_path = '' as $$
  select role from public.organization_members
   where organization_id = p_org and user_id = (select auth.uid());
$$;

-- "Can manage": the tournament's owner, or an OWNER/ORGANIZER of its organization.
create or replace function private.owns_tournament(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tournaments t
     where t.id = p_tournament_id
       and (t.owner_id = (select auth.uid())
            or (t.organization_id is not null and exists (
                  select 1 from public.organization_members m
                   where m.organization_id = t.organization_id
                     and m.user_id = (select auth.uid()))))
  );
$$;

create or replace function private.tournament_is_visible(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tournaments where id = p_tournament_id and status <> 'DRAFT')
      or private.owns_tournament(p_tournament_id);
$$;

-- Public pages may show an organization's name and logo once it has a published tournament.
create or replace function private.org_is_public(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tournaments where organization_id = p_org and status <> 'DRAFT');
$$;

-- Storage: "<tournament id>/…" for tournament managers, "orgs/<org id>/…" for org owners.
create or replace function private.owns_tournament_path(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_first text := split_part(p_name, '/', 1);
  v_uuid  text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if v_first = 'orgs' then
    if split_part(p_name, '/', 2) !~ v_uuid then return false; end if;
    return private.org_role(split_part(p_name, '/', 2)::uuid) = 'OWNER';
  end if;
  if v_first !~ v_uuid then return false; end if;
  return private.owns_tournament(v_first::uuid);
end $$;

revoke execute on function private.org_role(uuid), private.org_is_public(uuid) from public;
grant execute on function private.org_role(uuid), private.org_is_public(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Integrity
-- ----------------------------------------------------------------------------
-- The creator becomes the first OWNER; quota of 10 organizations per creator.
create or replace function public.organizations_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.organizations where created_by = new.created_by) >= 10 then
    raise exception 'LIMIT_ORGANIZATIONS';
  end if;
  return new;
end $$;

create or replace function public.organizations_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.organization_members (organization_id, user_id, role, email)
  values (new.id, new.created_by, 'OWNER', lower((select auth.jwt()) ->> 'email'));
  return null;
end $$;

create or replace function public.organizations_before_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger organizations_before_insert before insert on public.organizations
  for each row execute function public.organizations_before_insert();
create trigger organizations_after_insert after insert on public.organizations
  for each row execute function public.organizations_after_insert();
create trigger organizations_before_update before update on public.organizations
  for each row execute function public.organizations_before_update();

-- An organization always keeps at least one OWNER.
create or replace function public.members_keep_an_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'OWNER'
     and (tg_op = 'DELETE' or new.role <> 'OWNER')
     and exists (select 1 from public.organizations where id = old.organization_id)
     and not exists (select 1 from public.organization_members
                      where organization_id = old.organization_id and role = 'OWNER'
                        and user_id <> old.user_id) then
    raise exception 'LAST_OWNER';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger members_keep_an_owner before update or delete on public.organization_members
  for each row execute function public.members_keep_an_owner();

create or replace function public.invites_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.email := lower(btrim(new.email));
  if (select count(*) from public.organization_invites
       where organization_id = new.organization_id and accepted_at is null and expires_at > now()) >= 50 then
    raise exception 'LIMIT_INVITES';
  end if;
  if (select count(*) from public.organization_members where organization_id = new.organization_id) >= 50 then
    raise exception 'LIMIT_MEMBERS';
  end if;
  return new;
end $$;
create trigger invites_before_insert before insert on public.organization_invites
  for each row execute function public.invites_before_insert();

-- Tournaments may only be put into an organization the caller belongs to.
create or replace function public.tournaments_org_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.organization_id is not null
     and (tg_op = 'INSERT' or new.organization_id is distinct from old.organization_id)
     and private.org_role(new.organization_id) is null then
    raise exception 'NOT_ORG_MEMBER';
  end if;
  return new;
end $$;
create trigger tournaments_org_check before insert or update of organization_id on public.tournaments
  for each row execute function public.tournaments_org_check();

-- ----------------------------------------------------------------------------
-- Invites: accept and preview through functions (tokens never listed publicly)
-- ----------------------------------------------------------------------------
create or replace function public.invite_preview(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  i public.organization_invites%rowtype;
  v_email text := lower((select auth.jwt()) ->> 'email');
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into i from public.organization_invites where token = p_token;
  if not found then return null; end if;
  return jsonb_build_object(
    'organization', (select name from public.organizations where id = i.organization_id),
    'role', i.role,
    'expired', i.expires_at < now(),
    'accepted', i.accepted_at is not null,
    'email_matches', i.email = v_email,
    -- Masked so a forwarded link doesn't reveal the invited address.
    'email_hint', left(i.email, 2) || '•••@' || split_part(i.email, '@', 2)
  );
end $$;

create or replace function public.accept_invite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  i public.organization_invites%rowtype;
  v_uid uuid := (select auth.uid());
  v_email text := lower((select auth.jwt()) ->> 'email');
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into i from public.organization_invites where token = p_token for update;
  if not found then raise exception 'INVITE_NOT_FOUND'; end if;
  if i.accepted_at is not null then raise exception 'INVITE_USED'; end if;
  if i.expires_at < now() then raise exception 'INVITE_EXPIRED'; end if;
  if i.email <> v_email then raise exception 'INVITE_WRONG_EMAIL'; end if;

  insert into public.organization_members (organization_id, user_id, role, email)
  values (i.organization_id, v_uid, i.role, v_email)
  on conflict (organization_id, user_id) do nothing;

  update public.organization_invites set accepted_at = now(), accepted_by = v_uid where id = i.id;
  return i.organization_id;
end $$;

revoke execute on function public.invite_preview(text), public.accept_invite(text) from public, anon;
grant execute on function public.invite_preview(text), public.accept_invite(text) to authenticated;
revoke execute on function
  public.organizations_before_insert(), public.organizations_after_insert(),
  public.organizations_before_update(), public.members_keep_an_owner(),
  public.invites_before_insert(), public.tournaments_org_check()
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invites enable row level security;

create policy "members or public read organizations" on public.organizations
  for select to anon, authenticated
  -- created_by is checked directly: during INSERT ... RETURNING the creator's
  -- membership row (added by trigger) isn't visible to the helper yet.
  using (created_by = (select auth.uid()) or private.org_role(id) is not null or private.org_is_public(id));
create policy "create organizations" on public.organizations
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "owners update organizations" on public.organizations
  for update to authenticated
  using (private.org_role(id) = 'OWNER') with check (private.org_role(id) = 'OWNER');
create policy "owners delete organizations" on public.organizations
  for delete to authenticated using (private.org_role(id) = 'OWNER');

create policy "members read members" on public.organization_members
  for select to authenticated using (private.org_role(organization_id) is not null);
create policy "owners change roles" on public.organization_members
  for update to authenticated
  using (private.org_role(organization_id) = 'OWNER') with check (private.org_role(organization_id) = 'OWNER');
create policy "owners remove members, anyone leaves" on public.organization_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or private.org_role(organization_id) = 'OWNER');

create policy "owners read invites" on public.organization_invites
  for select to authenticated using (private.org_role(organization_id) = 'OWNER');
create policy "owners create invites" on public.organization_invites
  for insert to authenticated with check (private.org_role(organization_id) = 'OWNER');
create policy "owners revoke invites" on public.organization_invites
  for delete to authenticated using (private.org_role(organization_id) = 'OWNER');

-- Tournaments: managers (not just the creator) can read drafts and update.
-- Deleting stays with the creator or an organization OWNER.
drop policy "read published or own tournaments" on public.tournaments;
drop policy "owner updates tournaments" on public.tournaments;
drop policy "owner deletes tournaments" on public.tournaments;
create policy "read published or managed tournaments" on public.tournaments
  for select to anon, authenticated
  -- owner_id is checked directly first: during INSERT ... RETURNING the new row
  -- isn't visible to the helper's snapshot yet.
  using (status <> 'DRAFT' or owner_id = (select auth.uid()) or private.owns_tournament(id));
create policy "managers update tournaments" on public.tournaments
  for update to authenticated
  using (owner_id = (select auth.uid()) or private.owns_tournament(id))
  with check (owner_id = (select auth.uid()) or private.owns_tournament(id));
create policy "creator or org owner deletes tournaments" on public.tournaments
  for delete to authenticated
  using (owner_id = (select auth.uid())
         or (organization_id is not null and private.org_role(organization_id) = 'OWNER'));

-- ----------------------------------------------------------------------------
-- Privileges
-- ----------------------------------------------------------------------------
revoke all on public.organizations, public.organization_members, public.organization_invites from anon, authenticated;
grant select on public.organizations to anon, authenticated;
grant insert (name), update (name, logo_path), delete on public.organizations to authenticated;
grant select (organization_id, user_id, role, email, created_at), update (role), delete
  on public.organization_members to authenticated;
grant select, delete on public.organization_invites to authenticated;
grant insert (organization_id, email, role) on public.organization_invites to authenticated;
grant insert (organization_id), update (organization_id) on public.tournaments to authenticated;

-- ----------------------------------------------------------------------------
-- Bundle: include the organization (name, logo) and whether the caller can manage.
-- ----------------------------------------------------------------------------
create or replace function public.tournament_bundle(p_tournament_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'tournament', to_jsonb(t),
    'organization', (select jsonb_build_object('id', o.id, 'name', o.name, 'logo_path', o.logo_path)
                       from public.organizations o where o.id = t.organization_id),
    'can_manage', private.owns_tournament(t.id),
    'courts', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order, c.name)
                          from public.courts c where c.tournament_id = t.id), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at)
                              from public.categories c where c.tournament_id = t.id), '[]'::jsonb),
    'players', coalesce((select jsonb_agg(to_jsonb(p) order by p.name)
                           from public.players p where p.tournament_id = t.id), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(to_jsonb(e) order by e.seed nulls last, e.created_at)
                           from public.entries e where e.tournament_id = t.id), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(
               to_jsonb(m) || jsonb_build_object('games', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'game_number', g.game_number, 'score_a', g.score_a,
                          'score_b', g.score_b, 'winner_side', g.winner_side)
                        order by g.game_number)
                   from public.match_games g where g.match_id = m.id), '[]'::jsonb))
               order by m.round, m.position nulls last, m.created_at)
        from public.matches m where m.tournament_id = t.id), '[]'::jsonb)
  )
  from public.tournaments t
  where t.id = p_tournament_id;
$$;
