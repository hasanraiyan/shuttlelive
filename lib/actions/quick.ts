"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { explainDbError } from "@/lib/scoring";
import type { ActionResult } from "@/lib/types";
import { firstError } from "@/lib/validation";

const name = z.string().trim().min(1, "Enter both players' names.").max(80, "Names can be at most 80 characters.");
const optional = z
  .string()
  .trim()
  .max(80, "Names can be at most 80 characters.")
  .optional()
  .transform((v) => (v ? v : null));

const quickSchema = z
  .object({
    kind: z.enum(["SINGLES", "DOUBLES"]),
    a1: name,
    a2: optional,
    b1: name,
    b2: optional,
    preset: z.enum(["BWF_21", "BAI_15", "QUICK_21", "SHORT_15"]),
  })
  .refine((d) => d.kind === "SINGLES" || (d.a2 && d.b2), { message: "Doubles needs two players on each side." });

/** Creates a one-off match and opens it for scoring. */
export async function createQuickMatch(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = quickSchema.safeParse({
    kind: fd.get("kind"),
    a1: fd.get("a1"),
    a2: fd.get("a2") ?? undefined,
    b1: fd.get("b1"),
    b2: fd.get("b2") ?? undefined,
    preset: fd.get("preset"),
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const doubles = d.kind === "DOUBLES";

  const { supabase } = await requireUser("/dashboard/quick");
  const { data, error } = await supabase.rpc("create_quick_match", {
    p_a1: d.a1,
    p_b1: d.b1,
    p_a2: doubles ? d.a2 : null,
    p_b2: doubles ? d.b2 : null,
    p_preset: d.preset,
  });
  if (error || !data) return { ok: false, error: explainDbError(error?.message) };
  const res = data as { tournament_id: string; match_id: string };
  revalidatePath("/dashboard");
  redirect(`/dashboard/t/${res.tournament_id}/m/${res.match_id}`);
}
