-- Move RLS helper functions out of the API-exposed `public` schema.
-- Policies reference functions by OID, so they keep working after the move,
-- but the helpers are no longer reachable at /rest/v1/rpc/*.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

alter function public.owns_tournament(uuid)        set schema private;
alter function public.tournament_is_visible(uuid)  set schema private;
alter function public.owns_tournament_path(text)   set schema private;
alter function public.match_state(uuid)            set schema private;
alter function public.advance_winner(public.matches, text) set schema private;
alter function public.is_reserved_slug(text)       set schema private;
alter function public.rules_for_preset(text)       set schema private;

-- Function bodies use search_path = '' with schema-qualified names, so callers
-- that referenced public.<helper> must be updated.
create or replace function private.owns_tournament_path(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_folder text := split_part(p_name, '/', 1);
begin
  if v_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.owns_tournament(v_folder::uuid);
end $$;

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
    new.rules := private.rules_for_preset(v_preset);
  else
    if (new.entry_a_id is distinct from old.entry_a_id or new.entry_b_id is distinct from old.entry_b_id)
       and old.status <> 'SCHEDULED' then
      raise exception 'MATCH_ALREADY_STARTED';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;

-- Re-point the three API functions at the private helpers.
do $$
declare
  fn text;
  def text;
begin
  foreach fn in array array[
    'public.apply_match_command(uuid, text, integer, uuid, text, text)',
    'public.generate_knockout(uuid)',
    'public.clear_knockout(uuid)'
  ] loop
    def := pg_get_functiondef(fn::regprocedure);
    def := replace(def, 'public.owns_tournament(', 'private.owns_tournament(');
    def := replace(def, 'public.match_state(', 'private.match_state(');
    def := replace(def, 'public.advance_winner(', 'private.advance_winner(');
    execute def;
  end loop;
end $$;

-- Privileges on the moved helpers.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.owns_tournament(uuid),
  private.tournament_is_visible(uuid),
  private.owns_tournament_path(text)
  to anon, authenticated;

-- Storage policies referenced public.owns_tournament_path by OID; recreate them
-- with the qualified name so the definitions read correctly.
drop policy if exists "owner reads tournament media"   on storage.objects;
drop policy if exists "owner uploads tournament media" on storage.objects;
drop policy if exists "owner updates tournament media" on storage.objects;
drop policy if exists "owner deletes tournament media" on storage.objects;
create policy "owner reads tournament media" on storage.objects
  for select to authenticated
  using (bucket_id = 'tournament-media' and private.owns_tournament_path(name));
create policy "owner uploads tournament media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tournament-media' and private.owns_tournament_path(name));
create policy "owner updates tournament media" on storage.objects
  for update to authenticated
  using (bucket_id = 'tournament-media' and private.owns_tournament_path(name))
  with check (bucket_id = 'tournament-media' and private.owns_tournament_path(name));
create policy "owner deletes tournament media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'tournament-media' and private.owns_tournament_path(name));
