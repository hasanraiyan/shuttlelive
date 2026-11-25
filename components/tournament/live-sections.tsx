"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { LocalTime } from "@/components/app/local-time";
import { Bracket } from "@/components/tournament/bracket";
import { ScoreFlip } from "@/components/ui/score-flip";
import { useLiveMatches, useLiveViewers } from "@/lib/live";
import { byOrderOfPlay } from "@/lib/schedule";
import { REASON_LABEL, callout, isActive, isDone, roundName } from "@/lib/scoring";
import type { Category, Court, Entry, MatchWithGames } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  tournamentId: string;
  completed: boolean;
  slug: string;
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
export function LiveSections({ tournamentId, completed, slug, initialMatches, entries, courts, categories }: Props) {
  const router = useRouter();
  const [matches, setMatches] = React.useState(initialMatches);
  const connected = useLiveMatches(tournamentId, setMatches, !completed);
  const viewers = useLiveViewers(tournamentId, { enabled: !completed });

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

  // Podium per category: final winner, runner-up, and the losing semi-finalists.
  const loserOf = (m: MatchWithGames) => (m.winner_side === "A" ? m.entry_b_id : m.entry_a_id);
  const winnerOf = (m: MatchWithGames) => (m.winner_side === "A" ? m.entry_a_id : m.entry_b_id);
  const podiums = categories
    .map((c) => {
      const last = rounds[c.id];
      const final = matches.find((m) => m.category_id === c.id && m.position !== null && m.round === last && isDone(m));
      if (!final?.winner_side) return null;
      const semis = last > 1 ? matches.filter((m) => m.category_id === c.id && m.round === last - 1 && isDone(m) && m.winner_side) : [];
      return {
        category: c.name,
        gold: names[winnerOf(final) ?? ""],
        silver: names[loserOf(final) ?? ""],
        bronze: semis.map((m) => names[loserOf(m) ?? ""]).filter(Boolean),
      };
    })
    .filter(Boolean) as { category: string; gold: string; silver: string; bronze: string[] }[];
  const matchHref = (m: MatchWithGames) => `/t/${slug}/m/${m.id}`;

  return (
    <>
      {!completed && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-soft" aria-live="polite">
          <p className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", connected ? "bg-live" : "bg-warn")} aria-hidden="true" />
            {connected ? "Scores update live" : "Connecting to live scores…"}
          </p>
          {viewers !== null && viewers > 0 && (
            <p className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 font-medium text-ink">
              <Eye className="size-3.5 text-court" aria-hidden="true" />
              <span className="tabular-nums">{viewers}</span>
              <span>{viewers === 1 ? "person watching" : "people watching"}</span>
            </p>
          )}
        </div>
      )}

      {podiums.length > 0 && (
        <section>
          <h2 className="font-display text-3xl">{completed ? "Champions" : "Winners so far"}</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {podiums.map((p) => (
              <li key={p.category} className="overflow-hidden rounded-lg border border-line">
                <p className="bg-court px-4 py-2 text-sm font-semibold text-court-line">{p.category}</p>
                <dl className="divide-y divide-line">
                  <div className="flex items-baseline justify-between gap-3 px-4 py-3">
                    <dt className="text-sm text-ink-soft">Winner</dt>
                    <dd className="font-display text-2xl">{p.gold}</dd>
                  </div>
                  {p.silver && (
                    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                      <dt className="text-sm text-ink-soft">Runner-up</dt>
                      <dd className="font-semibold">{p.silver}</dd>
                    </div>
                  )}
                  {p.bronze.length > 0 && (
                    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                      <dt className="text-sm text-ink-soft">Semi-finalists</dt>
                      <dd className="text-right">{p.bronze.join(", ")}</dd>
                    </div>
                  )}
                </dl>
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
              <LiveCard key={m.id} m={m} names={names} court={m.court_id ? courtName[m.court_id] : null} label={label(m)} href={matchHref(m)} />
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
                <li key={m.id}>
                  <Link href={matchHref(m)} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-surface-2 sm:px-2">
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
                  </Link>
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

function LiveCard({
  m,
  names,
  court,
  label,
  href,
}: {
  m: MatchWithGames;
  names: Record<string, string>;
  court: string | null;
  label: string;
  href: string;
}) {
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
          <ScoreFlip
            value={side === "A" ? m.score_a : m.score_b}
            minDigits={2}
            className="w-[2ch] justify-end text-5xl"
          />
        </div>
      ))}
      <p className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold text-ink">{call ?? ""}</span>
        <Link href={href} className="shrink-0 font-semibold text-court underline underline-offset-4">
          Commentary
        </Link>
      </p>
    </li>
  );
}
