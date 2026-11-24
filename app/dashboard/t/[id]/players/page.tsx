import { Suspense } from "react";
import { PlayersManager } from "@/components/dashboard/players-manager";
import { getOwnedBundle } from "@/lib/data";

export const metadata = { title: "Players" };

export default function PlayersPage({ params }: PageProps<"/dashboard/t/[id]/players">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Loading players…</p>}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tournament, players, entries } = await getOwnedBundle(id);
  const entryCount: Record<string, number> = {};
  for (const e of entries) {
    for (const pid of [e.player1_id, e.player2_id]) if (pid) entryCount[pid] = (entryCount[pid] ?? 0) + 1;
  }
  return <PlayersManager tid={tournament.id} players={players} entryCount={entryCount} />;
}
