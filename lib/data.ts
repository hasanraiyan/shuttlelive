import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentUserId, requireUser } from "@/lib/auth";
import { createPublicClient } from "@/lib/supabase/server";
import { tags } from "@/lib/tags";
import type {
  Category,
  CommentaryEvent,
  Court,
  Entry,
  MatchWithGames,
  Organization,
  OrgInvite,
  OrgMember,
  OrgRole,
  Player,
  Tournament,
} from "@/lib/types";
import { uuid } from "@/lib/validation";

export type Bundle = {
  tournament: Tournament;
  organization: { id: string; name: string; logo_path: string | null } | null;
  can_manage: boolean;
  courts: Court[];
  categories: Category[];
  players: Player[];
  entries: Entry[];
  matches: MatchWithGames[];
};

/** One database round trip for the whole tournament (see tournament_bundle in migrations). */
async function fetchBundle(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.rpc("tournament_bundle", { p_tournament_id: id });
  return (data as Bundle | null) ?? null;
}

/**
 * A tournament the signed-in user owns, loaded once per request. The dashboard
 * layout calls this and shares the result with every tab, so switching tabs
 * makes no further database calls.
 */
export const getOwnedBundle = cache(async (id: string): Promise<Bundle> => {
  if (!uuid.safeParse(id).success) notFound();
  const { supabase } = await requireUser(`/dashboard/t/${id}`);
  const bundle = await fetchBundle(supabase, id);
  // RLS returns drafts only to managers, but published tournaments to everyone,
  // so check the explicit flag (owner, or member of the tournament's organization).
  if (!bundle || !bundle.can_manage) notFound();
  return bundle;
});

export type MyOrg = Organization & { role: OrgRole };

/** Organizations the signed-in user belongs to, with their role. */
export async function listMyOrganizations(): Promise<MyOrg[]> {
  const { supabase, userId } = await requireUser("/dashboard");
  const { data } = await supabase
    .from("organization_members")
    .select("role, organization:organizations(*)")
    .eq("user_id", userId);
  return ((data ?? []) as unknown as { role: OrgRole; organization: Organization }[])
    .filter((r) => r.organization)
    .map((r) => ({ ...r.organization, role: r.role }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Tournaments and quick matches the user can manage: their own plus their organizations'. */
export async function listManagedTournaments() {
  const { supabase, userId } = await requireUser("/dashboard");
  const orgs = await listMyOrganizations();
  const filter = orgs.length
    ? `owner_id.eq.${userId},organization_id.in.(${orgs.map((o) => o.id).join(",")})`
    : `owner_id.eq.${userId}`;
  const { data } = await supabase
    .from("tournaments")
    .select("*")
    .or(filter)
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);
  return { tournaments: (data ?? []) as Tournament[], orgs };
}

export type PublicResult =
  | { kind: "ok"; bundle: Bundle }
  | { kind: "redirect"; slug: string }
  | { kind: "missing" };

/**
 * Public page data, shared by every visitor. Uses the anonymous client (no
 * cookies), so RLS returns published tournaments only and one cached copy
 * serves everyone. Server actions invalidate it by tag; live scores reach
 * open pages through Realtime.
 */
export async function getPublicBundle(slug: string): Promise<PublicResult> {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.slug(slug));

  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return { kind: "missing" };
  const { data } = await createPublicClient().rpc("tournament_bundle_by_slug", { p_slug: slug });
  const res = data as (Bundle & { redirect?: string }) | null;
  if (!res) return { kind: "missing" };
  if (res.redirect) return { kind: "redirect", slug: res.redirect };
  cacheTag(tags.tournament(res.tournament.id));
  return { kind: "ok", bundle: res };
}

/** A draft, for people who can manage it (preview). Not cached: it depends on who is signed in. */
export async function getDraftForOwner(slug: string): Promise<Bundle | null> {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const { supabase, userId } = await currentUserId();
  if (!userId) return null;
  const { data } = await supabase.rpc("tournament_bundle_by_slug", { p_slug: slug });
  const bundle = data as (Bundle & { redirect?: string }) | null;
  return bundle?.tournament && bundle.can_manage ? bundle : null;
}

/** Public commentary for a match, cached with its tournament (invalidated on every scoring change). */
export async function getPublicCommentary(tournamentId: string, matchId: string): Promise<CommentaryEvent[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.tournament(tournamentId));
  const { data } = await createPublicClient().rpc("match_commentary", { p_match_id: matchId });
  return (data as CommentaryEvent[] | null) ?? [];
}

/** Commentary for a draft, read as the signed-in manager (not cached). */
export async function getDraftCommentary(matchId: string): Promise<CommentaryEvent[]> {
  const { supabase } = await currentUserId();
  const { data } = await supabase.rpc("match_commentary", { p_match_id: matchId });
  return (data as CommentaryEvent[] | null) ?? [];
}

export type OrgPage = {
  org: Organization;
  myRole: OrgRole;
  members: OrgMember[];
  invites: OrgInvite[];
  tournaments: Tournament[];
  me: string;
};

/** Organization settings page. Invites are only returned to owners (RLS). */
export async function getOrgPage(id: string): Promise<OrgPage> {
  if (!uuid.safeParse(id).success) notFound();
  const { supabase, userId } = await requireUser(`/dashboard/orgs/${id}`);
  const [org, members, invites, tournaments] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", id).maybeSingle(),
    supabase.from("organization_members").select("*").eq("organization_id", id).order("created_at"),
    supabase
      .from("organization_invites")
      .select("*")
      .eq("organization_id", id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("tournaments").select("*").eq("organization_id", id).order("start_date", { ascending: false }),
  ]);
  const list = (members.data ?? []) as OrgMember[];
  const mine = list.find((m) => m.user_id === userId);
  if (!org.data || !mine) notFound();
  return {
    org: org.data as Organization,
    myRole: mine.role,
    members: list,
    invites: (invites.data ?? []) as OrgInvite[],
    tournaments: (tournaments.data ?? []) as Tournament[],
    me: userId,
  };
}

export type PublicLiveMatchPreview = {
  id: string;
  courtName: string | null;
  playerA: string;
  playerB: string;
  scoreA: number;
  scoreB: number;
  gamesA: number;
  gamesB: number;
  currentGame: number;
};

export type PublicTournamentSummary = {
  id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  hostName: string | null;
  venueName: string | null;
  venueAddress: string | null;
  startDate: string;
  endDate: string;
  status: "PUBLISHED" | "COMPLETED";
  logoPath: string | null;
  brandPrimary: string | null;
  brandAccent: string | null;
  liveMatches: PublicLiveMatchPreview[];
};

/**
 * Public tournament directory for the landing page. Cached briefly and
 * invalidated on tournament/scoring changes via tags.publicTournaments.
 */
export async function listPublicTournaments(): Promise<PublicTournamentSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(tags.publicTournaments);

  const supabase = createPublicClient();
  const { data: rows } = await supabase
    .from("tournaments")
    .select(
      "id, name, slug, subtitle, host_name, venue_name, venue_address, start_date, end_date, status, logo_path, brand_primary, brand_accent, organization_id"
    )
    .eq("visibility", "PUBLIC")
    .neq("status", "DRAFT")
    .eq("kind", "TOURNAMENT")
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  const tournaments = (rows ?? []) as {
    id: string;
    name: string;
    slug: string;
    subtitle: string | null;
    host_name: string | null;
    venue_name: string | null;
    venue_address: string | null;
    start_date: string;
    end_date: string;
    status: "PUBLISHED" | "COMPLETED";
    logo_path: string | null;
    brand_primary: string | null;
    brand_accent: string | null;
    organization_id: string | null;
  }[];

  if (tournaments.length === 0) return [];

  const tournamentIds = tournaments.map((t) => t.id);
  const orgIds = Array.from(
    new Set(tournaments.map((t) => t.organization_id).filter((id): id is string => Boolean(id)))
  );

  const [{ data: liveMatchRows }, { data: orgRows }] = await Promise.all([
    supabase
      .from("matches")
      .select("id, tournament_id, court_id, entry_a_id, entry_b_id, score_a, score_b, games_won_a, games_won_b, current_game")
      .in("tournament_id", tournamentIds)
      .eq("status", "LIVE")
      .limit(100),
    orgIds.length
      ? supabase.from("organizations").select("id, name, logo_path").in("id", orgIds)
      : Promise.resolve({ data: [] }),
  ]);

  const orgMap = new Map(
    ((orgRows ?? []) as { id: string; name: string; logo_path: string | null }[]).map((o) => [o.id, o])
  );

  const liveMatches = (liveMatchRows ?? []) as {
    id: string;
    tournament_id: string;
    court_id: string | null;
    entry_a_id: string | null;
    entry_b_id: string | null;
    score_a: number;
    score_b: number;
    games_won_a: number;
    games_won_b: number;
    current_game: number;
  }[];

  const entryMap = new Map<string, string>();
  const courtMap = new Map<string, string>();

  if (liveMatches.length > 0) {
    const entryIds = Array.from(
      new Set(liveMatches.flatMap((m) => [m.entry_a_id, m.entry_b_id]).filter((id): id is string => Boolean(id)))
    );
    const courtIds = Array.from(
      new Set(liveMatches.map((m) => m.court_id).filter((id): id is string => Boolean(id)))
    );

    const [{ data: entries }, { data: courts }] = await Promise.all([
      entryIds.length ? supabase.from("entries").select("id, display_name").in("id", entryIds) : Promise.resolve({ data: [] }),
      courtIds.length ? supabase.from("courts").select("id, name").in("id", courtIds) : Promise.resolve({ data: [] }),
    ]);

    for (const e of (entries ?? []) as { id: string; display_name: string }[]) {
      entryMap.set(e.id, e.display_name);
    }
    for (const c of (courts ?? []) as { id: string; name: string }[]) {
      courtMap.set(c.id, c.name);
    }
  }

  const liveByTournament = new Map<string, PublicLiveMatchPreview[]>();
  for (const m of liveMatches) {
    const list = liveByTournament.get(m.tournament_id) ?? [];
    list.push({
      id: m.id,
      courtName: m.court_id ? courtMap.get(m.court_id) ?? null : null,
      playerA: (m.entry_a_id && entryMap.get(m.entry_a_id)) || "TBD",
      playerB: (m.entry_b_id && entryMap.get(m.entry_b_id)) || "TBD",
      scoreA: m.score_a,
      scoreB: m.score_b,
      gamesA: m.games_won_a,
      gamesB: m.games_won_b,
      currentGame: m.current_game,
    });
    liveByTournament.set(m.tournament_id, list);
  }

  return tournaments.map((t) => {
    const org = t.organization_id ? orgMap.get(t.organization_id) : undefined;
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      subtitle: t.subtitle,
      hostName: t.host_name ?? org?.name ?? null,
      venueName: t.venue_name,
      venueAddress: t.venue_address,
      startDate: t.start_date,
      endDate: t.end_date,
      status: t.status,
      logoPath: t.logo_path ?? org?.logo_path ?? null,
      brandPrimary: t.brand_primary,
      brandAccent: t.brand_accent,
      liveMatches: liveByTournament.get(t.id) ?? [],
    };
  });
}
