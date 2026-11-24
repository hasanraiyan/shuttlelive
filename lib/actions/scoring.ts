"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { tournamentChanged } from "@/lib/revalidate";
import { explainDbError } from "@/lib/scoring";
import type { ActionResult, MatchWithGames } from "@/lib/types";

const commandSchema = z.object({
  tournamentId: z.string().uuid(),
  matchId: z.string().uuid(),
  command: z.enum(["START", "POINT", "UNDO", "NEXT_GAME", "CONFIRM", "TERMINATE"]),
  expectedVersion: z.number().int().min(1),
  clientEventId: z.string().uuid(),
  side: z.enum(["A", "B"]).optional(),
  reason: z.enum(["WALKOVER", "RETIREMENT", "DISQUALIFICATION"]).optional(),
});

export type ScoreResult = ActionResult<MatchWithGames> & { conflict?: boolean };

/** Every scoring change goes through the database function, which checks ownership itself. */
export async function scoreMatch(input: z.input<typeof commandSchema>): Promise<ScoreResult> {
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid scoring command." };
  const c = parsed.data;

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("apply_match_command", {
    p_match_id: c.matchId,
    p_command: c.command,
    p_expected_version: c.expectedVersion,
    p_client_event_id: c.clientEventId,
    p_side: c.side ?? null,
    p_reason: c.reason ?? null,
  });

  if (error) {
    const conflict = error.message.startsWith("VERSION_CONFLICT");
    return { ok: false, error: explainDbError(error.message), conflict };
  }

  // Points only mark the shared public page stale (open pages update via Realtime,
  // and the dashboard patches its own state). Start, confirm and early finishes
  // also move players between matches, so the dashboard reloads its data.
  tournamentChanged(c.tournamentId, { dashboard: ["START", "CONFIRM", "TERMINATE"].includes(c.command) });
  return { ok: true, data: data as MatchWithGames };
}
