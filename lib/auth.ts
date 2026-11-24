import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Verifies the session and returns the user id. getClaims() checks the JWT
 * signature against the project's cached public key (ES256), so this costs no
 * network call. Row-level security still guards every query.
 */
export async function requireUser(redirectTo = "/dashboard") {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(`/sign-in?redirect=${encodeURIComponent(redirectTo)}`);
  return { supabase, userId };
}

/** Like requireUser, but returns null instead of redirecting. */
export async function currentUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}
