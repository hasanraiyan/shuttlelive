import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: matchId } = await params;
  const supabase = await createClient();

  const { data: match, error } = await supabase
    .from("matches")
    .select(`
      *,
      tournament:tournaments(name, slug, venue_name),
      category:categories(name, type),
      court:courts(name),
      entry_a:entries!matches_entry_a_id_fkey(id, display_name, seed_number),
      entry_b:entries!matches_entry_b_id_fkey(id, display_name, seed_number),
      games:match_games(*),
      events:match_events(*)
    `)
    .eq("id", matchId)
    .single();

  if (error || !match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  // Generate fact-based commentary from events
  const rawEvents = (match.events || []) as Array<{
    event_type: string;
    side: "A" | "B" | null;
    score_a_after: number;
    score_b_after: number;
    game_number: number;
    created_at: string;
  }>;

  const commentary = rawEvents
    .filter((e) => ["POINT_WON", "INTERVAL_START", "GAME_END", "RESULT_CONFIRMED"].includes(e.event_type))
    .slice(-15)
    .reverse()
    .map((e) => {
      const nameA = match.entry_a?.display_name || "Side A";
      const nameB = match.entry_b?.display_name || "Side B";
      const scorerName = e.side === "A" ? nameA : nameB;

      let text = `${scorerName} wins the rally (${e.score_a_after}–${e.score_b_after})`;
      if (e.event_type === "INTERVAL_START") {
        text = `Interval reached at ${e.score_a_after}–${e.score_b_after}. Players take a 60-second break.`;
      } else if (e.event_type === "GAME_END") {
        text = `${scorerName} wins Game ${e.game_number} (${e.score_a_after}–${e.score_b_after})!`;
      } else if (e.event_type === "RESULT_CONFIRMED") {
        text = `Match completed! Official result confirmed.`;
      }

      return {
        timestamp: e.created_at,
        score: `${e.score_a_after}–${e.score_b_after}`,
        text,
      };
    });

  return NextResponse.json(
    { match, commentary },
    {
      headers: {
        "Cache-Control": "public, s-maxage=2, stale-while-revalidate=1",
      },
    }
  );
}
