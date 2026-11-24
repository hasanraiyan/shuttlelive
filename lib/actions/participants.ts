"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Player, Entry } from "@/lib/types/database";

export async function createPlayer(tournamentId: string, input: {
  name: string;
  displayName?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  department?: string;
  studentId?: string;
  phone?: string;
  teamId?: string;
}) {
  const supabase = await createClient();

  const { data: player, error } = await supabase
    .from("players")
    .insert({
      tournament_id: tournamentId,
      name: input.name,
      display_name: input.displayName || input.name,
      gender: input.gender || null,
      department: input.department || null,
      student_id: input.studentId || null,
      phone: input.phone || null,
      team_id: input.teamId || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/tournaments/${tournamentId}`);
  return player as Player;
}

export async function bulkImportPlayers(tournamentId: string, playersList: Array<{
  name: string;
  department?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  phone?: string;
}>) {
  const supabase = await createClient();

  const inserts = playersList.map((p) => ({
    tournament_id: tournamentId,
    name: p.name,
    display_name: p.name,
    department: p.department || null,
    gender: p.gender || null,
    phone: p.phone || null,
  }));

  const { data, error } = await supabase.from("players").insert(inserts).select();
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/tournaments/${tournamentId}`);
  return data as Player[];
}

export async function registerCategoryEntry(categoryId: string, input: {
  playerIds: string[]; // 1 for singles, 2 for doubles
  displayName?: string;
  seedNumber?: number;
  teamId?: string;
}) {
  const supabase = await createClient();

  // 1. Fetch player names if displayName not provided
  let computedName = input.displayName;
  if (!computedName) {
    const { data: playerRows } = await supabase
      .from("players")
      .select("display_name, name")
      .in("id", input.playerIds);

    computedName = (playerRows || []).map((p) => p.display_name || p.name).join(" / ");
  }

  // 2. Insert Entry
  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .insert({
      category_id: categoryId,
      team_id: input.teamId || null,
      display_name: computedName || "Contestant",
      seed_number: input.seedNumber || null,
    })
    .select()
    .single();

  if (entryError || !entry) {
    throw new Error(entryError?.message || "Failed to register entry");
  }

  // 3. Link Entry Members
  const memberInserts = input.playerIds.map((playerId) => ({
    entry_id: entry.id,
    player_id: playerId,
  }));
  await supabase.from("entry_members").insert(memberInserts);

  return entry as Entry;
}

export async function listTournamentPlayers(tournamentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select("*, team:teams(*)")
    .eq("tournament_id", tournamentId)
    .order("name");

  if (error) return [];
  return data as Player[];
}
