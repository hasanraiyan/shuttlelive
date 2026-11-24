import { Suspense } from "react";
import { MatchesBoard } from "@/components/dashboard/matches-board";
import { ShareLinks } from "@/components/tournament/share-links";
import { getOwnedBundle } from "@/lib/data";
import { siteUrl } from "@/lib/format";

export const metadata = { title: "Matches" };

export default function TournamentPage({ params }: PageProps<"/dashboard/t/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Loading matches…</p>}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getOwnedBundle(id);
  const names = Object.fromEntries(b.entries.map((e) => [e.id, e.display_name]));
  return (
    <div className="space-y-10">
      {b.tournament.status !== "DRAFT" && (
        <ShareLinks url={siteUrl(`/t/${b.tournament.slug}`)} title={b.tournament.name} />
      )}
      <MatchesBoard tid={b.tournament.id} matches={b.matches} courts={b.courts} categories={b.categories} names={names} />
    </div>
  );
}
