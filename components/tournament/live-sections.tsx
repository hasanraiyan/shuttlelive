"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LocalTime } from "@/components/app/local-time";
import { Bracket } from "@/components/tournament/bracket";
import { useLiveMatches } from "@/lib/live";
import { byOrderOfPlay } from "@/lib/schedule";
import { REASON_LABEL, callout, isActive, isDone, roundName } from "@/lib/scoring";
import type { Category, Court, Entry, MatchWithGames } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  tournamentId: string;
  completed: boolean;
  initialMatches: MatchWithGames[];
  entries: Entry[];
  courts: Court[];
  categories: Category[];
};

/**
 * Everything on the public page that changes during play. It starts from the
 * cached server copy and applies Realtime row changes in the browser, so a
 * point scored costs each viewer one small message, not a page reload.
 */
export function LiveSections({ tournamentId, completed, initialMatches, entries, courts, categories }: Props) {
  const router = useRouter();
  const [matches, setMatches] = React.useState(initialMatches);
  const connected = useLiveMatches(tournamentId, setMatches, !completed);

  const names = React.useMemo(() => Object.fromEntries(entries.map((e) => [e.id, e.display_name])), [entries]);

  // A match referring to an entry this page doesn't know means the draw changed: reload once.
  const unknown = matches.some(
    (m) => (m.entry_a_id && !names[m.entry_a_id]) || (m.entry_b_id && !names[m.entry_b_id])
  );
  const refreshed = React.useRef(false);
  React.useEffect(() => {
    if (unknown && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [unknown, router]);

  const courtName = Object.fromEntries(courts.map((c) => [c.id, c.name]));
  const catName = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const rounds: Record<string, number> = {};
  for (const m of matches) if (m.position !== null) rounds[m.category_id] = Math.max(rounds[m.category_id] ?? 0, m.round);
  const label = (m: MatchWithGames) =>
    `${catName[m.category_id] ?? ""}${m.position !== null ? `, ${roundName(m.round, rounds[m.category_id] ?? m.round)}` : ""}`;

  const live = matches.filter(isActive);
  const next = matches.filter((m) => m.status === "SCHEDULED" && m.entry_a_id && m.entry_b_id).sort(byOrderOfPlay);
  const results = matches
    .filter((m) => isDone(m) && m.result_reason !== "BYE")
    .sort((x, y) => (y.finished_at ?? "").localeCompare(x.finished_at ?? ""));

  const champions = categories
    .map((c) => {
      const final = matches.find((m) => m.category_id === c.id && m.position !== null && m.round === rounds[c.id] && isDone(m));
      const winner = final?.winner_side ? (final.winner_side === "A" ? final.entry_a_id : final.entry_b_id) : null;
      return winner && names[winner] ? { category: c.name, name: names[winner] } : null;
    })
    .filter(Boolean) as { category: string; name: string }[];

  return (
    <>
      {!completed && (
        <p className="flex items-center gap-2 text-xs text-ink-soft" aria-live="polite">
          <span className={cn("size-2 rounded-full", connected ? "bg-live" : "bg-warn")} aria-hidden="true" />
          {connected ? "Scores update live" : "Connecting to live scores…"}
        </p>
      )}

      {champions.length > 0 && (
        <section>
          <h2 className="font-display text-3xl">Champions</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {champions.map((c) => (
              <li key={c.category} className="rounded-md bg-court px-4 py-3 text-court-line">
                <p className="text-sm opacity-85">{c.category}</p>
                <p className="font-display text-2xl">{c.name}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {live.length > 0 && (
        <section>
          <h2 className="font-display text-3xl">On court now</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {live.map((m) => (
              <LiveCard key={m.id} m={m} names={names} court={m.court_id ? courtName[m.court_id] : null} label={label(m)} />
            ))}
          </ul>
        </section>
      )}

      {next.length > 0 && (
        <section>
          <h2 className="font-display text-3xl">Up next</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {next.slice(0, 12).map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {names[m.entry_a_id!]} <span className="text-ink-soft">v</span> {names[m.entry_b_id!]}
                  </span>
                  <span className="text-sm text-ink-soft">{label(m)}</span>
                </span>
                <span className="text-right text-sm">
                  {m.scheduled_at && <LocalTime iso={m.scheduled_at} className="block font-semibold" />}
                  {m.court_id && <span className="text-ink-soft">{courtName[m.court_id]}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.length > 0 && (
        <section>
          <h2 className="font-display text-3xl">Results</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {results.slice(0, 30).map((m) => {
              const winnerId = m.winner_side === "A" ? m.entry_a_id : m.entry_b_id;
              const loserId = m.winner_side === "A" ? m.entry_b_id : m.entry_a_id;
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="min-w-0">
                    <span className="block truncate">
                      <strong>{winnerId ? names[winnerId] : "?"}</strong> beat {loserId ? names[loserId] : "?"}
                    </span>
                    <span className="text-sm text-ink-soft">{label(m)}</span>
                  </span>
                  <span className="font-score text-xl">
                    {m.result_reason && m.result_reason !== "NORMAL"
                      ? REASON_LABEL[m.result_reason]
                      : m.games.map((g) => (m.winner_side === "A" ? `${g.score_a}–${g.score_b}` : `${g.score_b}–${g.score_a}`)).join(", ")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {categories.map((c) => {
        const drawn = matches.filter((m) => m.category_id === c.id && m.position !== null);
        if (!drawn.length) return null;
        return (
          <section key={c.id}>
            <h2 className="font-display text-3xl">{c.name}</h2>
            <div className="mt-4">
              <Bracket matches={drawn} names={names} />
            </div>
          </section>
        );
      })}

      {!matches.length && (
        <p className="rounded-md bg-surface-2 px-4 py-6 text-center text-ink-soft">
          The draw hasn&apos;t been published yet. Check back closer to the start.
        </p>
      )}
    </>
  );
}

function LiveCard({ m, names, court, label }: { m: MatchWithGames; names: Record<string, string>; court: string | null; label: string }) {
  const n = { A: names[m.entry_a_id!], B: names[m.entry_b_id!] };
  const call = callout(m, n);
  return (
    <li className="rounded-lg border border-live p-4">
      <p className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold">{court ?? "Court not set"}</span>
        <span className="text-ink-soft">{label}</span>
      </p>
      {(["A", "B"] as const).map((side) => (
        <div key={side} className="mt-3 flex items-center gap-3">
          <span
            className={cn("size-2 shrink-0 rounded-full", m.serving_side === side && m.status === "LIVE" ? "bg-live" : "bg-transparent")}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate font-medium">{n[side]}</span>
          <span className="font-score flex gap-3 text-ink-soft">
            {m.games
              .filter((g) => g.game_number < m.current_game || m.status !== "LIVE")
              .map((g) => (
                <span key={g.game_number} className="text-xl">
                  {side === "A" ? g.score_a : g.score_b}
                </span>
              ))}
          </span>
          <span className="font-score w-[2ch] text-right text-5xl">{side === "A" ? m.score_a : m.score_b}</span>
        </div>
      ))}
      {call && <p className="mt-3 text-sm font-semibold text-warn">{call}</p>}
    </li>
  );
}
