"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function generateKnockoutDraw(categoryId: string) {
  const supabase = await createClient();

  // 1. Fetch category and tournament details
  const { data: category } = await supabase
    .from("categories")
    .select("*, tournament:tournaments(*)")
    .eq("id", categoryId)
    .single();

  if (!category) throw new Error("Category not found");

  // 2. Fetch all registered entries
  const { data: entries } = await supabase
    .from("entries")
    .select("*")
    .eq("category_id", categoryId)
    .order("seed_number", { ascending: true, nullsFirst: false });

  if (!entries || entries.length < 2) {
    throw new Error("At least 2 entries are required to generate a bracket.");
  }

  const n = entries.length;
  // Calculate power of 2 bracket size
  let bracketSize = 2;
  while (bracketSize < n) {
    bracketSize *= 2;
  }
  const byesCount = bracketSize - n;
  const numRounds = Math.log2(bracketSize);

  // Round names mapping
  const getRoundName = (roundIndex: number, totalRounds: number) => {
    const roundsFromEnd = totalRounds - roundIndex;
    if (roundsFromEnd === 1) return "Final";
    if (roundsFromEnd === 2) return "Semifinals";
    if (roundsFromEnd === 3) return "Quarterfinals";
    if (roundsFromEnd === 4) return "Round of 16";
    if (roundsFromEnd === 5) return "Round of 32";
    return `Round ${roundIndex + 1}`;
  };

  // 3. Create Category Rounds
  const roundIds: string[] = [];
  for (let r = 0; r < numRounds; r++) {
    const roundName = getRoundName(r, numRounds);
    const { data: roundRow } = await supabase
      .from("category_rounds")
      .insert({
        category_id: categoryId,
        round_name: roundName,
        round_order: r + 1,
      })
      .select()
      .single();

    if (roundRow) roundIds.push(roundRow.id);
  }

  // 4. Default Scoring Rules Snapshot
  const rulesSnapshot = {
    best_of: 3,
    points_to_win: 21,
    win_by: 2,
    max_points: 30,
    interval_at: 11,
  };

  // 5. Generate Match Tree from Finals backward
  // Matches per round: r=0 (Round 1) has bracketSize/2 matches; r=numRounds-1 has 1 match (Final)
  const roundMatches: Array<Array<{ id: string; slotA?: string; slotB?: string }>> = [];

  for (let r = numRounds - 1; r >= 0; r--) {
    const matchesInRound = Math.pow(2, numRounds - 1 - r);
    const currentRoundList: Array<{ id: string; slotA?: string; slotB?: string }> = [];

    for (let m = 0; m < matchesInRound; m++) {
      let nextMatchId: string | null = null;
      let nextMatchSlot: "A" | "B" | null = null;

      if (r < numRounds - 1) {
        // Link to match in round r+1
        const parentMatchIndex = Math.floor(m / 2);
        nextMatchId = roundMatches[numRounds - 2 - r][parentMatchIndex].id;
        nextMatchSlot = m % 2 === 0 ? "A" : "B";
      }

      const { data: matchRow } = await supabase
        .from("matches")
        .insert({
          tournament_id: category.tournament_id,
          category_id: categoryId,
          round_id: roundIds[r],
          next_match_id: nextMatchId,
          next_match_slot: nextMatchSlot,
          status: "SCHEDULED",
          rules_snapshot: rulesSnapshot,
        })
        .select("id")
        .single();

      if (matchRow) {
        currentRoundList.push({ id: matchRow.id });
      }
    }
    roundMatches.push(currentRoundList);
  }

  // 6. Slot First Round Entries and Distribute Byes
  // roundMatches[numRounds - 1] contains the first round matches
  const firstRoundMatches = roundMatches[numRounds - 1];
  const sortedEntries = [...entries];

  // Distribute entries into slots
  let entryIdx = 0;
  for (let i = 0; i < firstRoundMatches.length; i++) {
    const matchId = firstRoundMatches[i].id;
    const entryA = sortedEntries[entryIdx++] || null;
    let entryB = null;

    // If we have remaining byes to distribute, give this match a bye (no entryB)
    if (i < byesCount) {
      entryB = null;
    } else {
      entryB = sortedEntries[entryIdx++] || null;
    }

    if (entryA && !entryB) {
      // Bye match: pre-advance entryA to next round
      await supabase
        .from("matches")
        .update({
          entry_a_id: entryA.id,
          winner_entry_id: entryA.id,
          status: "FINALIZED",
          termination_reason: "WALKOVER",
        })
        .eq("id", matchId);

      // Advance into next round slot directly
      const currentMatch = await supabase.from("matches").select("next_match_id, next_match_slot").eq("id", matchId).single();
      if (currentMatch.data?.next_match_id) {
        if (currentMatch.data.next_match_slot === "A") {
          await supabase.from("matches").update({ entry_a_id: entryA.id }).eq("id", currentMatch.data.next_match_id);
        } else {
          await supabase.from("matches").update({ entry_b_id: entryA.id }).eq("id", currentMatch.data.next_match_id);
        }
      }
    } else if (entryA && entryB) {
      await supabase
        .from("matches")
        .update({
          entry_a_id: entryA.id,
          entry_b_id: entryB.id,
        })
        .eq("id", matchId);
    }
  }

  // Lock category draws
  await supabase.from("categories").update({ is_locked: true }).eq("id", categoryId);

  revalidatePath(`/dashboard/tournaments/${category.tournament_id}`);
  return { success: true, bracketSize, byesCount };
}

export async function getCategoryBracket(categoryId: string) {
  const supabase = await createClient();

  const { data: rounds } = await supabase
    .from("category_rounds")
    .select(`
      *,
      matches(
        *,
        court:courts(*),
        entry_a:entries!matches_entry_a_id_fkey(*),
        entry_b:entries!matches_entry_b_id_fkey(*),
        games:match_games(*)
      )
    `)
    .eq("category_id", categoryId)
    .order("round_order", { ascending: true });

  return rounds || [];
}
