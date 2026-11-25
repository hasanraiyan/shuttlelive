"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { tournamentChanged } from "@/lib/revalidate";
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
  const parsed = createTournamentSchema.safeParse(fields(fd, [...DETAIL_KEYS, "slug", "courts", "organization_id"]));
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
  tournamentChanged(tournamentId);
  revalidatePath("/dashboard");
  return { ok: true, message: "Details saved." };
}

export async function updateSlug(tournamentId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "Invalid tournament." };
  const parsed = slugSchema.safeParse(fd.get("slug"));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { supabase } = await requireUser();
  const { data: before } = await supabase.from("tournaments").select("slug").eq("id", tournamentId).maybeSingle();
  const { error } = await supabase.from("tournaments").update({ slug: parsed.data }).eq("id", tournamentId);
  if (error) return { ok: false, error: explainDbError(error.message) };
  tournamentChanged(tournamentId, { slugs: [parsed.data, ...(before?.slug ? [before.slug] : [])] });
  return { ok: true, message: "Web address updated. The old address now redirects here." };
}

export async function setTournamentStatus(
  tournamentId: string,
  status: "DRAFT" | "PUBLISHED" | "COMPLETED"
): Promise<ActionResult> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "Invalid tournament." };
  if (!["DRAFT", "PUBLISHED", "COMPLETED"].includes(status)) return { ok: false, error: "Invalid status." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("tournaments")
    .update({ status })
    .eq("id", tournamentId)
    .select("slug")
    .maybeSingle();
  if (error) return { ok: false, error: explainDbError(error.message) };
  tournamentChanged(tournamentId, { slugs: data?.slug ? [data.slug] : [] });
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteTournament(tournamentId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "Invalid tournament." };
  const { supabase, userId } = await requireUser();
  const { data: t } = await supabase
    .from("tournaments")
    .select("slug, owner_id, organization_id")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!t) return { ok: false, error: explainDbError("NOT_FOUND") };
  if ((fd.get("confirm") as string | null)?.trim() !== t.slug) {
    return { ok: false, error: `Type ${t.slug} to confirm.` };
  }

  // Same rule as the database: the creator or an owner of its organization.
  let allowed = t.owner_id === userId;
  if (!allowed && t.organization_id) {
    const { data: m } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", t.organization_id)
      .eq("user_id", userId)
      .maybeSingle();
    allowed = m?.role === "OWNER";
  }
  if (!allowed) return { ok: false, error: "Only the person who created this tournament or an organization owner can delete it." };

  // Stored images first (afterwards nobody would be allowed to remove them).
  const { data: files } = await supabase.storage.from("tournament-media").list(tournamentId, { limit: 100 });
  if (files?.length) {
    await supabase.storage.from("tournament-media").remove(files.map((f) => `${tournamentId}/${f.name}`));
  }
  const { error, count } = await supabase.from("tournaments").delete({ count: "exact" }).eq("id", tournamentId);
  if (error) return { ok: false, error: explainDbError(error.message) };
  if (!count) return { ok: false, error: "The tournament couldn't be deleted. Try again." };
  tournamentChanged(tournamentId, { slugs: [t.slug], dashboard: false });
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

  tournamentChanged(tournamentId);
  return { ok: true };
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/");
}

const hexOrNull = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, "Choose a colour.")
  .nullable();

/** Appearance studio: event colour and header colour (null = ShuttleLive default). */
export async function setBrandColors(
  tournamentId: string,
  primary: string | null,
  accent: string | null
): Promise<ActionResult> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "Invalid tournament." };
  const p = hexOrNull.safeParse(primary);
  const a = hexOrNull.safeParse(accent);
  if (!p.success || !a.success) return { ok: false, error: "Choose valid colours." };
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("tournaments")
    .update({ brand_primary: p.data, brand_accent: a.data })
    .eq("id", tournamentId);
  if (error) return { ok: false, error: explainDbError(error.message) };
  tournamentChanged(tournamentId);
  return { ok: true, message: "Colours saved." };
}

/** Move a tournament into one of your organizations, or back to personal (null). */
export async function setTournamentOrganization(tournamentId: string, orgId: string | null): Promise<ActionResult> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "Invalid tournament." };
  if (orgId !== null && !uuid.safeParse(orgId).success) return { ok: false, error: "Invalid organization." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("tournaments").update({ organization_id: orgId }).eq("id", tournamentId);
  if (error) return { ok: false, error: explainDbError(error.message) };
  tournamentChanged(tournamentId);
  revalidatePath("/dashboard");
  return { ok: true, message: orgId ? "Moved to the organization." : "Moved to your personal tournaments." };
}

/** Enable or disable the AI voice assistant on the tournament's public pages. */
export async function setVoiceAssistantEnabled(tournamentId: string, enabled: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "Invalid tournament." };
  if (typeof enabled !== "boolean") return { ok: false, error: "Invalid setting." };
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("tournaments")
    .update({ voice_assistant_enabled: enabled })
    .eq("id", tournamentId);
  if (error) return { ok: false, error: explainDbError(error.message) };
  tournamentChanged(tournamentId);
  revalidatePath("/dashboard");
  return { ok: true, message: enabled ? "Voice assistant enabled." : "Voice assistant disabled." };
}
