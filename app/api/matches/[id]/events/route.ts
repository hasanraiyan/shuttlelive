import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

interface CommandPayload {
  type: "POINT_WON" | "UNDO" | "START_MATCH" | "START_NEXT_GAME" | "FINALIZE_RESULT" | "TERMINATE";
  side?: "A" | "B";
  expectedVersion?: number;
  clientEventId?: string;
  reason?: "WALKOVER" | "RETIREMENT" | "DISQUALIFICATION";
  winnerEntryId?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: matchId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const body: CommandPayload = await request.json();
    let result: Record<string, unknown> = {};

    switch (body.type) {
      case "POINT_WON": {
        if (!body.side) throw new Error("Missing side parameter ('A' or 'B').");
        const { data, error } = await supabase.rpc("record_point_event", {
          p_match_id: matchId,
          p_side: body.side,
          p_client_event_id: body.clientEventId || crypto.randomUUID(),
          p_expected_version: body.expectedVersion || 1,
          p_scorer_id: user?.id || null,
        });
        if (error) throw new Error(error.message);
        result = data;
        break;
      }

      case "UNDO": {
        const { data, error } = await supabase.rpc("undo_point_event", {
          p_match_id: matchId,
          p_client_event_id: body.clientEventId || crypto.randomUUID(),
          p_scorer_id: user?.id || null,
        });
        if (error) throw new Error(error.message);
        result = data;
        break;
      }

      case "START_MATCH": {
        const { data, error } = await supabase.rpc("start_match", {
          p_match_id: matchId,
          p_serving_side: body.side || "A",
          p_scorer_id: user?.id || null,
        });
        if (error) throw new Error(error.message);
        result = data;
        break;
      }

      case "START_NEXT_GAME": {
        const { data, error } = await supabase.rpc("start_next_game", {
          p_match_id: matchId,
          p_serving_side: body.side || "A",
          p_scorer_id: user?.id || null,
        });
        if (error) throw new Error(error.message);
        result = data;
        break;
      }

      case "FINALIZE_RESULT": {
        const { data, error } = await supabase.rpc("finalize_match", {
          p_match_id: matchId,
          p_scorer_id: user?.id || null,
        });
        if (error) throw new Error(error.message);
        result = data;
        break;
      }

      case "TERMINATE": {
        if (!body.winnerEntryId || !body.reason) {
          throw new Error("Missing winnerEntryId or reason for termination.");
        }
        const { data, error } = await supabase.rpc("terminate_match", {
          p_match_id: matchId,
          p_winner_entry_id: body.winnerEntryId,
          p_reason: body.reason,
          p_scorer_id: user?.id || null,
        });
        if (error) throw new Error(error.message);
        result = data;
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown command type." }, { status: 400 });
    }

    // Broadcast sub-100ms real-time event
    const channel = supabase.channel(`match:${matchId}`);
    channel.send({
      type: "broadcast",
      event: "score_update",
      payload: result,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error executing scoring command.";
    if (message.includes("VERSION_CONFLICT")) {
      return NextResponse.json({ error: "VERSION_CONFLICT", message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
