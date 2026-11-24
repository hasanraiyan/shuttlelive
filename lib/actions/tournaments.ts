"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { explainDbError } from "@/lib/scoring";
import type { ActionResult } from "@/lib/types";
import {
  createTournamentSchema,
  firstError,
  slugSchema,
  tournamentDetailsSchema,
  uuid,
} from "@/lib/validation";

const fields = (fd: FormData, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, (fd.get(k) as string | null) ?? undefined]));

const DETAIL_KEYS = [
  "name", "subtitle", "description", "host_name", "venue_name",
  "venue_address", "venue_map_url", "start_date", "end_date", "visibility",
];

export async function createTournament(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = createTournamentSchema.safeParse(fields(fd, [...DETAIL_KEYS, "slug", "courts"]));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { courts, ...row } = parsed.data;

  const { supabase } = await requireUser("/dashboard/new");
  const { data, error } = await supabase.from("tournaments").insert(row).select("id").single();
  if (error || !data) return { ok: false, error: explainDbError(error?.message) };

  const courtRows = Array.from({ length: courts }, (_, i) => ({
    tournament_id: data.id,
    name: `Court ${i + 1}`,
    sort_order: i + 1,
  }));
  const { error: courtError } = await supabase.from("courts").insert(courtRows);
  if (courtError) return { ok: false, error: explainDbError(courtError.message) };

  revalidatePath("/dashboard");
  redirect(`/dashboard/t/${data.id}`);
}

export async function updateTournamentDetails(
  tournamentId: string,
  _prev: ActionResult,
  fd: FormData
): Promise<ActionResult> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "Invalid tournament." };
  const parsed = tournamentDetailsSchema.safeParse(fields(fd, DETAIL_KEYS));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("tournaments").update(parsed.data).eq("id", tournamentId);
  if (error) return { ok: false, error: explainDbError(error.message) };
  revalidatePath(`/dashboard/t/${tournamentId}`, "layout");
  return { ok: true, message: "Details saved." };
}

export async function updateSlug(tournamentId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "Invalid tournament." };
  const parsed = slugSchema.safeParse(fd.get("slug"));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("tournaments").update({ slug: parsed.data }).eq("id", tournamentId);
  if (error) return { ok: false, error: explainDbError(error.message) };
  revalidatePath(`/dashboard/t/${tournamentId}`, "layout");
  return { ok: true, message: "Web address updated. The old address now redirects here." };
}

export async function setTournamentStatus(
  tournamentId: string,
  status: "DRAFT" | "PUBLISHED" | "COMPLETED"
): Promise<ActionResult> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "Invalid tournament." };
  if (!["DRAFT", "PUBLISHED", "COMPLETED"].includes(status)) return { ok: false, error: "Invalid status." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("tournaments").update({ status }).eq("id", tournamentId);
  if (error) return { ok: false, error: explainDbError(error.message) };
  revalidatePath(`/dashboard/t/${tournamentId}`, "layout");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteTournament(tournamentId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "Invalid tournament." };
  const { supabase } = await requireUser();
  const { data: t } = await supabase.from("tournaments").select("slug").eq("id", tournamentId).maybeSingle();
  if (!t) return { ok: false, error: explainDbError("NOT_FOUND") };
  if ((fd.get("confirm") as string | null)?.trim() !== t.slug) {
    return { ok: false, error: `Type ${t.slug} to confirm.` };
  }

  // Remove stored images first; the folder is named after the tournament.
  const { data: files } = await supabase.storage.from("tournament-media").list(tournamentId, { limit: 100 });
  if (files?.length) {
    await supabase.storage.from("tournament-media").remove(files.map((f) => `${tournamentId}/${f.name}`));
  }
  const { error } = await supabase.from("tournaments").delete().eq("id", tournamentId);
  if (error) return { ok: false, error: explainDbError(error.message) };
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function setTournamentImage(
  tournamentId: string,
  kind: "logo" | "banner",
  path: string | null
): Promise<ActionResult> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "Invalid tournament." };
  if (kind !== "logo" && kind !== "banner") return { ok: false, error: "Invalid image." };
  if (path !== null && !new RegExp(`^${tournamentId}/(logo|banner)-[a-z0-9-]{8,40}\\.(webp|png|jpg)$`).test(path)) {
    return { ok: false, error: "Invalid file path." };
  }

  const { supabase } = await requireUser();
  const column = kind === "logo" ? "logo_path" : "banner_path";
  const { data: before } = await supabase.from("tournaments").select(column).eq("id", tournamentId).maybeSingle();
  const { error } = await supabase.from("tournaments").update({ [column]: path }).eq("id", tournamentId);
  if (error) return { ok: false, error: explainDbError(error.message) };

  const old = (before as Record<string, string | null> | null)?.[column];
  if (old && old !== path) await supabase.storage.from("tournament-media").remove([old]);

  revalidatePath(`/dashboard/t/${tournamentId}`, "layout");
  return { ok: true };
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/");
}
