"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Tournament, TournamentBranding, Category, Court } from "@/lib/types/database";

export interface CreateTournamentInput {
  name: string;
  slug?: string;
  subtitle?: string;
  description?: string;
  organizerDisplayName: string;
  venueName: string;
  venueAddress?: string;
  venueGoogleMapsUrl?: string;
  startDate: string;
  endDate: string;
  visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
  courtCount?: number;
}

export async function createTournament(input: CreateTournamentInput) {
  const supabase = await createClient();

  // 1. Verify User
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be authenticated to create a tournament.");
  }

  // 2. Generate slug if not provided
  let slug = input.slug
    ? input.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-")
    : input.name.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-");

  // Prevent reserved slugs
  const RESERVED_SLUGS = ["admin", "api", "dashboard", "auth", "login", "tournaments", "explore", "settings", "live"];
  if (RESERVED_SLUGS.includes(slug)) {
    slug = `${slug}-cup`;
  }

  // Append random suffix if exists
  const { data: existing } = await supabase.from("tournaments").select("id").eq("slug", slug).maybeSingle();
  if (existing) {
    slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // 3. Insert Tournament
  const { data: tournament, error: trnError } = await supabase
    .from("tournaments")
    .insert({
      owner_id: user.id,
      name: input.name,
      slug,
      subtitle: input.subtitle || null,
      description: input.description || null,
      organizer_display_name: input.organizerDisplayName,
      venue_name: input.venueName,
      venue_address: input.venueAddress || null,
      venue_google_maps_url: input.venueGoogleMapsUrl || null,
      start_date: input.startDate,
      end_date: input.endDate,
      visibility: input.visibility || "PUBLIC",
      status: "DRAFT",
    })
    .select()
    .single();

  if (trnError || !tournament) {
    throw new Error(`Failed to create tournament: ${trnError?.message}`);
  }

  // 4. Create Default Branding
  await supabase.from("tournament_branding").insert({
    tournament_id: tournament.id,
    primary_color: "#0f172a",
    accent_color: "#10b981",
    theme_mode: "SYSTEM",
  });

  // 5. Create Default Courts
  const courtCount = input.courtCount || 2;
  const courtInserts = Array.from({ length: courtCount }).map((_, i) => ({
    tournament_id: tournament.id,
    name: `Court ${i + 1}`,
  }));
  await supabase.from("courts").insert(courtInserts);

  // 6. Create Standard Categories (MS, WS, MD)
  const defaultCategories = [
    { tournament_id: tournament.id, name: "Men's Singles", type: "SINGLES", gender_eligibility: "MEN", rule_preset: "BWF_STANDARD" },
    { tournament_id: tournament.id, name: "Women's Singles", type: "SINGLES", gender_eligibility: "WOMEN", rule_preset: "BWF_STANDARD" },
    { tournament_id: tournament.id, name: "Men's Doubles", type: "DOUBLES", gender_eligibility: "MEN", rule_preset: "BWF_STANDARD" },
  ];
  await supabase.from("categories").insert(defaultCategories);

  revalidatePath("/dashboard");
  return tournament as Tournament;
}

export async function getTournamentBySlug(slug: string) {
  const supabase = await createClient();

  // 1. Fetch tournament
  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !tournament) {
    // Check slug_redirects
    const { data: redirect } = await supabase
      .from("slug_redirects")
      .select("tournament_id, tournaments(slug)")
      .eq("previous_slug", slug)
      .maybeSingle();

    if (redirect && redirect.tournaments) {
      return { redirect: (redirect.tournaments as unknown as { slug: string }).slug };
    }
    return null;
  }

  // 2. Fetch branding, courts, and categories in parallel
  const [brandingRes, courtsRes, categoriesRes, liveMatchesRes] = await Promise.all([
    supabase.from("tournament_branding").select("*").eq("tournament_id", tournament.id).maybeSingle(),
    supabase.from("courts").select("*").eq("tournament_id", tournament.id).order("name"),
    supabase.from("categories").select("*").eq("tournament_id", tournament.id).order("name"),
    supabase
      .from("matches")
      .select(`
        *,
        court:courts(*),
        entry_a:entries!matches_entry_a_id_fkey(*),
        entry_b:entries!matches_entry_b_id_fkey(*),
        games:match_games(*)
      `)
      .eq("tournament_id", tournament.id)
      .eq("status", "LIVE"),
  ]);

  return {
    tournament: tournament as Tournament,
    branding: brandingRes.data as TournamentBranding | null,
    courts: (courtsRes.data || []) as Court[],
    categories: (categoriesRes.data || []) as Category[],
    liveMatches: liveMatchesRes.data || [],
  };
}

export async function listMyTournaments() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: tournaments, error } = await supabase
    .from("tournaments")
    .select(`
      *,
      branding:tournament_branding(*),
      categories(count),
      courts(count),
      matches(count)
    `)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return [];
  return tournaments;
}

export async function publishTournament(tournamentId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournaments")
    .update({ status: "PUBLISHED", updated_at: new Date().toISOString() })
    .eq("id", tournamentId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  return { success: true };
}
