import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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

async function loadChildren(supabase: SupabaseClient, tournament: Tournament): Promise<Bundle> {
  const id = tournament.id;
  const [courts, categories, players, entries, matches] = await Promise.all([
    supabase.from("courts").select("*").eq("tournament_id", id).order("sort_order").order("name"),
    supabase.from("categories").select("*").eq("tournament_id", id).order("created_at"),
    supabase.from("players").select("*").eq("tournament_id", id).order("name"),
    supabase.from("entries").select("*").eq("tournament_id", id).order("seed", { nullsFirst: false }).order("created_at"),
    supabase
      .from("matches")
      .select("*, games:match_games(game_number, score_a, score_b, winner_side)")
      .eq("tournament_id", id)
      .order("round")
      .order("position", { nullsFirst: false })
      .order("created_at"),
  ]);
  return {
    tournament,
    courts: (courts.data ?? []) as Court[],
    categories: (categories.data ?? []) as Category[],
    players: (players.data ?? []) as Player[],
    entries: (entries.data ?? []) as Entry[],
    matches: ((matches.data ?? []) as MatchWithGames[]).map((m) => ({
      ...m,
      games: [...(m.games ?? [])].sort((a, b) => a.game_number - b.game_number),
    })),
  };
}

/** A tournament the signed-in user owns, with everything needed to manage it. */
export const getOwnedBundle = cache(async (id: string): Promise<Bundle> => {
  if (!uuid.safeParse(id).success) notFound();
  const { supabase, user } = await requireUser(`/dashboard/t/${id}`);
  const { data } = await supabase.from("tournaments").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!data) notFound();
  return loadChildren(supabase, data as Tournament);
});

export async function listOwnedTournaments() {
  const { supabase, user } = await requireUser("/dashboard");
  const { data } = await supabase
    .from("tournaments")
    .select("*")
    .eq("owner_id", user.id)
    .order("start_date", { ascending: false });
  return (data ?? []) as Tournament[];
}

export type PublicResult =
  | { kind: "ok"; bundle: Bundle; isOwner: boolean }
  | { kind: "redirect"; slug: string }
  | { kind: "missing" };

/**
 * Public page data. RLS returns drafts only to their owner, so a draft link
 * is a 404 for everyone else.
 */
export const getPublicBundle = cache(async (slug: string): Promise<PublicResult> => {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return { kind: "missing" };
  const supabase = await createClient();
  const [{ data: t }, { data: userData }] = await Promise.all([
    supabase.from("tournaments").select("*").eq("slug", slug).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (!t) {
    const { data: r } = await supabase
      .from("slug_redirects")
      .select("tournament:tournaments(slug)")
      .eq("old_slug", slug)
      .maybeSingle();
    const target = (r?.tournament as unknown as { slug: string } | null)?.slug;
    return target ? { kind: "redirect", slug: target } : { kind: "missing" };
  }

  const tournament = t as Tournament;
  return {
    kind: "ok",
    bundle: await loadChildren(supabase, tournament),
    isOwner: userData.user?.id === tournament.owner_id,
  };
});
