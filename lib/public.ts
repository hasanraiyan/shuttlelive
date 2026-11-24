import "server-only";
import { notFound, permanentRedirect } from "next/navigation";
import { getDraftForOwner, getPublicBundle, type Bundle } from "@/lib/data";

/**
 * Resolves a public address: the shared cached copy when published, a redirect
 * for an old address, or the draft for someone who can manage it.
 */
export async function resolvePublic(slug: string, suffix = ""): Promise<{ bundle: Bundle; draft: boolean }> {
  const res = await getPublicBundle(slug);
  if (res.kind === "redirect") permanentRedirect(`/t/${res.slug}${suffix}`);
  if (res.kind === "ok") return { bundle: res.bundle, draft: false };
  const draft = await getDraftForOwner(slug);
  if (!draft) notFound();
  return { bundle: draft, draft: true };
}
