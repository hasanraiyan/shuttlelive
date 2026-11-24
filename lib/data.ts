import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentUserId, requireUser } from "@/lib/auth";
import { createPublicClient } from "@/lib/supabase/server";
import { tags } from "@/lib/tags";
import type { Category, Court, Entry, MatchWithGames, Player, Tournament } from "@/lib/types";
import { uuid } from "@/lib/validation";

export type Bundle = {
  tournament: Tournament;
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
  const { supabase, userId } = await requireUser(`/dashboard/t/${id}`);
  const bundle = await fetchBundle(supabase, id);
  if (!bundle || bundle.tournament.owner_id !== userId) notFound();
  return bundle;
});

export async function listOwnedTournaments() {
  const { supabase, userId } = await requireUser("/dashboard");
  const { data } = await supabase
    .from("tournaments")
    .select("*")
    .eq("owner_id", userId)
    .order("start_date", { ascending: false });
  return (data ?? []) as Tournament[];
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

/** A draft, for its owner only (preview). Not cached: it depends on who is signed in. */
export async function getDraftForOwner(slug: string): Promise<Bundle | null> {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const { supabase, userId } = await currentUserId();
  if (!userId) return null;
  const { data } = await supabase.rpc("tournament_bundle_by_slug", { p_slug: slug });
  const bundle = data as (Bundle & { redirect?: string }) | null;
  return bundle?.tournament?.owner_id === userId ? bundle : null;
}
