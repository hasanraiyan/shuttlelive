import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { tags } from "@/lib/tags";

/**
 * After a change to a tournament: refresh the organizer's dashboard layout
 * (which re-runs the single bundle query) and mark the shared public page
 * stale. Pass slugs when visibility or the address changes, so cached
 * "not found" and redirect results are cleared too.
 */
export function tournamentChanged(tid: string, opts: { slugs?: string[]; dashboard?: boolean } = {}) {
  if (opts.dashboard !== false) revalidatePath(`/dashboard/t/${tid}`, "layout");
  revalidateTag(tags.tournament(tid), "max");
  for (const s of opts.slugs ?? []) revalidateTag(tags.slug(s), "max");
}
