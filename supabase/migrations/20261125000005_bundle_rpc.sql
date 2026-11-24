-- One round trip for a whole tournament (performance).
-- SECURITY INVOKER: row-level security still decides what the caller can see,
-- so anonymous callers only ever get tournaments that are not drafts.

create or replace function public.tournament_bundle(p_tournament_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'tournament', to_jsonb(t),
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

-- Public page lookup by slug. Returns the bundle, a redirect target for an
-- old slug, or null.
create or replace function public.tournament_bundle_by_slug(p_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select public.tournament_bundle(t.id) from public.tournaments t where t.slug = p_slug),
    (select jsonb_build_object('redirect', t.slug)
       from public.slug_redirects r
       join public.tournaments t on t.id = r.tournament_id
      where r.old_slug = p_slug)
  );
$$;

revoke execute on function public.tournament_bundle(uuid), public.tournament_bundle_by_slug(text) from public;
grant execute on function public.tournament_bundle(uuid), public.tournament_bundle_by_slug(text) to anon, authenticated;
