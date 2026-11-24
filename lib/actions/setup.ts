"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { explainDbError } from "@/lib/scoring";
import type { ActionResult } from "@/lib/types";
import { categorySchema, courtNameSchema, firstError, parsePlayerLines, playerSchema, uuid } from "@/lib/validation";
import { z } from "zod";

const refresh = (tid: string) => revalidatePath(`/dashboard/t/${tid}`, "layout");
const bad = (msg = "Invalid request.") => ({ ok: false as const, error: msg });

// ── Players ────────────────────────────────────────────────────────────────

export async function addPlayers(tid: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(tid).success) return bad();
  const result = parsePlayerLines(String(fd.get("players") ?? ""));
  if ("error" in result) return bad(result.error);
  if (!result.players.length) return bad("Type at least one player name.");

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("players")
    .insert(result.players.map((p) => ({ ...p, tournament_id: tid })));
  if (error) return bad(explainDbError(error.message));
  refresh(tid);
  const n = result.players.length;
  return { ok: true, message: `Added ${n} player${n === 1 ? "" : "s"}.` };
}

export async function updatePlayer(tid: string, playerId: string, input: { name: string; club?: string }): Promise<ActionResult> {
  if (!uuid.safeParse(tid).success || !uuid.safeParse(playerId).success) return bad();
  const parsed = playerSchema.safeParse(input);
  if (!parsed.success) return bad(firstError(parsed.error));
  const { supabase } = await requireUser();
  const { error } = await supabase.from("players").update(parsed.data).eq("id", playerId).eq("tournament_id", tid);
  if (error) return bad(explainDbError(error.message));
  refresh(tid);
  return { ok: true };
}

export async function deletePlayer(tid: string, playerId: string): Promise<ActionResult> {
  if (!uuid.safeParse(tid).success || !uuid.safeParse(playerId).success) return bad();
  const { supabase } = await requireUser();
  const { error } = await supabase.from("players").delete().eq("id", playerId).eq("tournament_id", tid);
  if (error) return bad(explainDbError(error.message));
  refresh(tid);
  return { ok: true };
}

// ── Courts ─────────────────────────────────────────────────────────────────

export async function addCourt(tid: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(tid).success) return bad();
  const name = courtNameSchema.safeParse(fd.get("name"));
  if (!name.success) return bad(firstError(name.error));
  const { supabase } = await requireUser();
  const { count } = await supabase.from("courts").select("id", { count: "exact", head: true }).eq("tournament_id", tid);
  const { error } = await supabase.from("courts").insert({ tournament_id: tid, name: name.data, sort_order: (count ?? 0) + 1 });
  if (error) return bad(explainDbError(error.message));
  refresh(tid);
  return { ok: true, message: `${name.data} added.` };
}

export async function deleteCourt(tid: string, courtId: string): Promise<ActionResult> {
  if (!uuid.safeParse(tid).success || !uuid.safeParse(courtId).success) return bad();
  const { supabase } = await requireUser();
  const { data: busy } = await supabase
    .from("matches")
    .select("id")
    .eq("court_id", courtId)
    .in("status", ["LIVE", "GAME_ENDED", "MATCH_WON_PENDING"])
    .limit(1);
  if (busy?.length) return bad("This court has a match in progress.");
  const { error } = await supabase.from("courts").delete().eq("id", courtId).eq("tournament_id", tid);
  if (error) return bad(explainDbError(error.message));
  refresh(tid);
  return { ok: true };
}

// ── Categories & entries ───────────────────────────────────────────────────

export async function addCategory(tid: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(tid).success) return bad();
  const parsed = categorySchema.safeParse({
    name: fd.get("name"),
    kind: fd.get("kind"),
    rule_preset: fd.get("rule_preset"),
  });
  if (!parsed.success) return bad(firstError(parsed.error));
  const { supabase } = await requireUser();
  const { error } = await supabase.from("categories").insert({ ...parsed.data, tournament_id: tid });
  if (error) return bad(explainDbError(error.message));
  refresh(tid);
  return { ok: true, message: `${parsed.data.name} added.` };
}

export async function deleteCategory(tid: string, categoryId: string): Promise<ActionResult> {
  if (!uuid.safeParse(tid).success || !uuid.safeParse(categoryId).success) return bad();
  const { supabase } = await requireUser();
  const { data: played } = await supabase
    .from("matches")
    .select("id")
    .eq("category_id", categoryId)
    .neq("status", "SCHEDULED")
    .or("result_reason.is.null,result_reason.neq.BYE")
    .limit(1);
  if (played?.length) return bad("Matches in this category have been played, so it can't be deleted.");
  const { error } = await supabase.from("categories").delete().eq("id", categoryId).eq("tournament_id", tid);
  if (error) return bad(explainDbError(error.message));
  refresh(tid);
  return { ok: true };
}

const entrySchema = z.object({
  category_id: uuid,
  player1_id: uuid,
  player2_id: uuid.optional().or(z.literal("").transform(() => undefined)),
  seed: z.coerce.number().int().min(1).max(128).optional().or(z.literal("").transform(() => undefined)),
});

export async function addEntry(tid: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(tid).success) return bad();
  const parsed = entrySchema.safeParse({
    category_id: fd.get("category_id"),
    player1_id: fd.get("player1_id"),
    player2_id: fd.get("player2_id") ?? "",
    seed: fd.get("seed") ?? "",
  });
  if (!parsed.success) return bad("Choose the player for this entry.");
  const { supabase } = await requireUser();
  const { error } = await supabase.from("entries").insert({
    tournament_id: tid,
    category_id: parsed.data.category_id,
    player1_id: parsed.data.player1_id,
    player2_id: parsed.data.player2_id ?? null,
    seed: parsed.data.seed ?? null,
  });
  if (error) return bad(explainDbError(error.message));
  refresh(tid);
  return { ok: true, message: "Entry added." };
}

export async function deleteEntry(tid: string, entryId: string): Promise<ActionResult> {
  if (!uuid.safeParse(tid).success || !uuid.safeParse(entryId).success) return bad();
  const { supabase } = await requireUser();
  const { error } = await supabase.from("entries").delete().eq("id", entryId).eq("tournament_id", tid);
  if (error) return bad(explainDbError(error.message));
  refresh(tid);
  return { ok: true };
}

// ── Draws & fixtures ───────────────────────────────────────────────────────

export async function generateDraw(tid: string, categoryId: string): Promise<ActionResult> {
  if (!uuid.safeParse(tid).success || !uuid.safeParse(categoryId).success) return bad();
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("generate_knockout", { p_category_id: categoryId });
  if (error) return bad(explainDbError(error.message));
  refresh(tid);
  return { ok: true, message: `Draw made with ${data} matches.` };
}

export async function clearDraw(tid: string, categoryId: string): Promise<ActionResult> {
  if (!uuid.safeParse(tid).success || !uuid.safeParse(categoryId).success) return bad();
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("clear_knockout", { p_category_id: categoryId });
  if (error) return bad(explainDbError(error.message));
  refresh(tid);
  return { ok: true, message: "Draw removed." };
}

const fixtureSchema = z.object({
  category_id: uuid,
  entry_a_id: uuid,
  entry_b_id: uuid,
  court_id: uuid.optional().or(z.literal("").transform(() => undefined)),
});

export async function addFixture(tid: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(tid).success) return bad();
  const parsed = fixtureSchema.safeParse({
    category_id: fd.get("category_id"),
    entry_a_id: fd.get("entry_a_id"),
    entry_b_id: fd.get("entry_b_id"),
    court_id: fd.get("court_id") ?? "",
  });
  if (!parsed.success) return bad("Choose both sides of the match.");
  const { supabase } = await requireUser();
  const { error } = await supabase.from("matches").insert({
    tournament_id: tid,
    category_id: parsed.data.category_id,
    entry_a_id: parsed.data.entry_a_id,
    entry_b_id: parsed.data.entry_b_id,
    court_id: parsed.data.court_id ?? null,
  });
  if (error) return bad(explainDbError(error.message));
  refresh(tid);
  return { ok: true, message: "Match added." };
}

export async function assignCourt(tid: string, matchId: string, courtId: string | null): Promise<ActionResult> {
  if (!uuid.safeParse(tid).success || !uuid.safeParse(matchId).success) return bad();
  if (courtId !== null && !uuid.safeParse(courtId).success) return bad();
  const { supabase } = await requireUser();
  const { error } = await supabase.from("matches").update({ court_id: courtId }).eq("id", matchId).eq("tournament_id", tid);
  if (error) return bad(explainDbError(error.message));
  refresh(tid);
  return { ok: true };
}

export async function deleteFixture(tid: string, matchId: string): Promise<ActionResult> {
  if (!uuid.safeParse(tid).success || !uuid.safeParse(matchId).success) return bad();
  const { supabase } = await requireUser();
  const { error, count } = await supabase
    .from("matches")
    .delete({ count: "exact" })
    .eq("id", matchId)
    .eq("tournament_id", tid)
    .is("next_match_id", null);
  if (error) return bad(explainDbError(error.message));
  if (!count) return bad("Only unplayed matches outside a draw can be removed.");
  refresh(tid);
  return { ok: true };
}

export async function scheduleMatch(tid: string, matchId: string, iso: string | null): Promise<ActionResult> {
  if (!uuid.safeParse(tid).success || !uuid.safeParse(matchId).success) return bad();
  if (iso !== null) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()) || iso.length > 40) return bad("Choose a valid date and time.");
    iso = d.toISOString();
  }
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("matches")
    .update({ scheduled_at: iso })
    .eq("id", matchId)
    .eq("tournament_id", tid)
    .eq("status", "SCHEDULED");
  if (error) return bad(explainDbError(error.message));
  refresh(tid);
  return { ok: true };
}
