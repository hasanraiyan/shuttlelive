"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { tournamentChanged } from "@/lib/revalidate";
import { explainDbError } from "@/lib/scoring";
import type { ActionResult } from "@/lib/types";
import { firstError, uuid } from "@/lib/validation";

const orgName = z.string().trim().min(2, "Use at least 2 characters.").max(120, "Up to 120 characters.");
const role = z.enum(["OWNER", "ORGANIZER"]);
const bad = (error = "Invalid request.") => ({ ok: false as const, error });

/** Public pages of the organization's tournaments show its name and logo. */
async function refreshOrg(orgId: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("tournaments").select("id").eq("organization_id", orgId);
  for (const t of data ?? []) tournamentChanged(t.id, { dashboard: false });
  revalidatePath(`/dashboard/orgs/${orgId}`);
  revalidatePath("/dashboard/orgs");
  revalidatePath("/dashboard");
}

export async function createOrganization(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const name = orgName.safeParse(fd.get("name"));
  if (!name.success) return bad(firstError(name.error));
  const { supabase } = await requireUser("/dashboard/orgs");
  const { data, error } = await supabase.from("organizations").insert({ name: name.data }).select("id").single();
  if (error || !data) return bad(explainDbError(error?.message));
  revalidatePath("/dashboard/orgs");
  redirect(`/dashboard/orgs/${data.id}`);
}

export async function renameOrganization(orgId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(orgId).success) return bad();
  const name = orgName.safeParse(fd.get("name"));
  if (!name.success) return bad(firstError(name.error));
  const { supabase } = await requireUser();
  const { error, count } = await supabase
    .from("organizations")
    .update({ name: name.data }, { count: "exact" })
    .eq("id", orgId);
  if (error) return bad(explainDbError(error.message));
  if (!count) return bad("Only owners can rename the organization.");
  await refreshOrg(orgId);
  return { ok: true, message: "Name saved." };
}

export async function setOrganizationLogo(orgId: string, path: string | null): Promise<ActionResult> {
  if (!uuid.safeParse(orgId).success) return bad();
  if (path !== null && !new RegExp(`^orgs/${orgId}/logo-[a-z0-9-]{8,40}\\.(webp|jpg)$`).test(path)) {
    return bad("Invalid file path.");
  }
  const { supabase } = await requireUser();
  const { data: before } = await supabase.from("organizations").select("logo_path").eq("id", orgId).maybeSingle();
  const { error, count } = await supabase
    .from("organizations")
    .update({ logo_path: path }, { count: "exact" })
    .eq("id", orgId);
  if (error) return bad(explainDbError(error.message));
  if (!count) return bad("Only owners can change the logo.");
  if (before?.logo_path && before.logo_path !== path) {
    await supabase.storage.from("tournament-media").remove([before.logo_path]);
  }
  await refreshOrg(orgId);
  return { ok: true };
}

export async function createInvite(orgId: string, _prev: ActionResult<{ token: string }>, fd: FormData): Promise<ActionResult<{ token: string }>> {
  if (!uuid.safeParse(orgId).success) return bad();
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(320), role })
    .safeParse({ email: fd.get("email"), role: fd.get("role") });
  if (!parsed.success) return bad(firstError(parsed.error));
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("organization_invites")
    .insert({ organization_id: orgId, email: parsed.data.email, role: parsed.data.role })
    .select("token")
    .single();
  if (error || !data) {
    return bad(/row-level security/.test(error?.message ?? "") ? "Only owners can invite people." : explainDbError(error?.message));
  }
  revalidatePath(`/dashboard/orgs/${orgId}`);
  return { ok: true, data: { token: data.token }, message: `Invite created for ${parsed.data.email}.` };
}

export async function revokeInvite(orgId: string, inviteId: string): Promise<ActionResult> {
  if (!uuid.safeParse(orgId).success || !uuid.safeParse(inviteId).success) return bad();
  const { supabase } = await requireUser();
  const { error } = await supabase.from("organization_invites").delete().eq("id", inviteId).eq("organization_id", orgId);
  if (error) return bad(explainDbError(error.message));
  revalidatePath(`/dashboard/orgs/${orgId}`);
  return { ok: true };
}

export async function changeMemberRole(orgId: string, userId: string, newRole: string): Promise<ActionResult> {
  if (!uuid.safeParse(orgId).success || !uuid.safeParse(userId).success) return bad();
  const r = role.safeParse(newRole);
  if (!r.success) return bad();
  const { supabase } = await requireUser();
  const { error, count } = await supabase
    .from("organization_members")
    .update({ role: r.data }, { count: "exact" })
    .eq("organization_id", orgId)
    .eq("user_id", userId);
  if (error) return bad(explainDbError(error.message));
  if (!count) return bad("Only owners can change roles.");
  revalidatePath(`/dashboard/orgs/${orgId}`);
  return { ok: true };
}

export async function removeMember(orgId: string, userId: string): Promise<ActionResult> {
  if (!uuid.safeParse(orgId).success || !uuid.safeParse(userId).success) return bad();
  const { supabase, userId: me } = await requireUser();
  const { error, count } = await supabase
    .from("organization_members")
    .delete({ count: "exact" })
    .eq("organization_id", orgId)
    .eq("user_id", userId);
  if (error) return bad(explainDbError(error.message));
  if (!count) return bad("Only owners can remove other members.");
  if (userId === me) {
    revalidatePath("/dashboard");
    redirect("/dashboard/orgs");
  }
  revalidatePath(`/dashboard/orgs/${orgId}`);
  return { ok: true };
}

export async function deleteOrganization(orgId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(orgId).success) return bad();
  const { supabase } = await requireUser();
  const { data: org } = await supabase.from("organizations").select("name, logo_path").eq("id", orgId).maybeSingle();
  if (!org) return bad(explainDbError("NOT_FOUND"));
  if ((fd.get("confirm") as string | null)?.trim() !== org.name) return bad(`Type ${org.name} to confirm.`);
  const { data: tournaments } = await supabase.from("tournaments").select("id").eq("organization_id", orgId);
  const { error, count } = await supabase.from("organizations").delete({ count: "exact" }).eq("id", orgId);
  if (error) return bad(explainDbError(error.message));
  if (!count) return bad("Only owners can delete the organization.");
  if (org.logo_path) await supabase.storage.from("tournament-media").remove([org.logo_path]);
  for (const t of tournaments ?? []) tournamentChanged(t.id, { dashboard: false });
  revalidatePath("/dashboard");
  redirect("/dashboard/orgs");
}

export async function acceptInvite(token: string): Promise<ActionResult> {
  if (!/^[0-9a-f]{48}$/.test(token)) return bad(explainDbError("INVITE_NOT_FOUND"));
  const { supabase } = await requireUser(`/invite/${token}`);
  const { data, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error || !data) return bad(explainDbError(error?.message));
  revalidatePath("/dashboard");
  redirect(`/dashboard/orgs/${data as string}`);
}
