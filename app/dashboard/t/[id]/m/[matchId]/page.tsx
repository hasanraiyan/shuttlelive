import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ScoreConsole } from "@/components/dashboard/score-console";
import { getOwnedBundle } from "@/lib/data";
import { roundName } from "@/lib/scoring";

export const metadata = { title: "Score match" };

export default function ScorePage({ params }: PageProps<"/dashboard/t/[id]/m/[matchId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Loading match…</p>}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ id: string; matchId: string }> }) {
  const { id, matchId } = await params;
  const b = await getOwnedBundle(id);
  const match = b.matches.find((m) => m.id === matchId);
  if (!match || !match.entry_a_id || !match.entry_b_id) notFound();

  const name = (eid: string) => b.entries.find((e) => e.id === eid)?.display_name ?? "Unknown";
  const category = b.categories.find((c) => c.id === match.category_id);
  const rounds = Math.max(0, ...b.matches.filter((m) => m.category_id === match.category_id && m.position !== null).map((m) => m.round));
  const context = `${category?.name ?? ""}${match.position !== null ? `, ${roundName(match.round, rounds)}` : ""}`;

  return (
    <ScoreConsole
      key={match.id}
      tid={b.tournament.id}
      initial={match}
      names={{ A: name(match.entry_a_id), B: name(match.entry_b_id) }}
      context={context}
      courtName={b.courts.find((c) => c.id === match.court_id)?.name ?? null}
    />
  );
}
