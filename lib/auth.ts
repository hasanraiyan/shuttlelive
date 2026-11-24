import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Verifies the session with Supabase Auth (not just the cookie) and returns the user. */
export async function requireUser(redirectTo = "/dashboard") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?redirect=${encodeURIComponent(redirectTo)}`);
  return { supabase, user };
}
