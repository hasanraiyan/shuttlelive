"use client";

import { notFound, useParams } from "next/navigation";
import { DrawsManager } from "@/components/dashboard/draws-manager";
import { MatchesBoard } from "@/components/dashboard/matches-board";
import { PlayersManager } from "@/components/dashboard/players-manager";
import { ScoreConsole } from "@/components/dashboard/score-console";
import { CourtsForm, DangerZone, DetailsForm, ImagesForm, SlugForm } from "@/components/dashboard/settings-forms";
import { useTournament } from "@/components/dashboard/tournament-context";
import { ShareLinks } from "@/components/tournament/share-links";
import { siteUrl } from "@/lib/format";
import { roundName } from "@/lib/scoring";

/* Each dashboard tab reads the tournament from context: no server round trip on tab switch. */

export function MatchesTab() {
  const { bundle: b } = useTournament();
  const names = Object.fromEntries(b.entries.map((e) => [e.id, e.display_name]));
  return (
    <div className="space-y-10">
      {b.tournament.status !== "DRAFT" && <ShareLinks url={siteUrl(`/t/${b.tournament.slug}`)} title={b.tournament.name} />}
      <MatchesBoard
        tid={b.tournament.id}
        matches={b.matches}
        courts={b.courts}
        categories={b.categories}
        names={names}
        entries={b.entries}
        players={b.players}
      />
    </div>
  );
}

export function PlayersTab() {
  const { bundle: b } = useTournament();
  const entryCount: Record<string, number> = {};
  for (const e of b.entries) {
    for (const pid of [e.player1_id, e.player2_id]) if (pid) entryCount[pid] = (entryCount[pid] ?? 0) + 1;
  }
  return <PlayersManager tid={b.tournament.id} players={b.players} entryCount={entryCount} />;
}

export function DrawsTab() {
  const { bundle: b } = useTournament();
  return (
    <DrawsManager
      tid={b.tournament.id}
      categories={b.categories}
      players={b.players}
      entries={b.entries}
      matches={b.matches}
      courts={b.courts}
    />
  );
}

export function SettingsTab() {
  const { bundle: b } = useTournament();
  const t = b.tournament;
  return (
    <div className="space-y-12">
      <DetailsForm key={t.updated_at} t={t} />
      <ImagesForm t={t} />
      <CourtsForm tid={t.id} courts={b.courts} />
      <SlugForm key={t.slug} t={t} />
      <DangerZone t={t} />
    </div>
  );
}

export function ScoreTab() {
  const { matchId } = useParams<{ matchId: string }>();
  const { bundle: b, patchMatch } = useTournament();
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
      external={match}
      onMatch={patchMatch}
      names={{ A: name(match.entry_a_id), B: name(match.entry_b_id) }}
      context={context}
      courtName={b.courts.find((c) => c.id === match.court_id)?.name ?? null}
    />
  );
}
