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
