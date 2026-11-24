"use client";

import * as React from "react";
import Link from "next/link";
import { LeadChart, SidesLegend } from "@/components/tournament/lead-chart";
import { ShareLinks } from "@/components/tournament/share-links";
import { buildCommentary, isKeyLine, type Line } from "@/lib/commentary";
import { useLiveMatches } from "@/lib/live";
import { matchStats, matchSummary, type SideStats } from "@/lib/match-stats";
import { REASON_LABEL, STATUS_LABEL, callout, isDone } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/client";
import type { CommentaryEvent, MatchWithGames, Side } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  tournamentId: string;
  backHref: string;
  backLabel: string;
  shareUrl: string;
  shareTitle: string;
  initial: MatchWithGames;
  initialEvents: CommentaryEvent[];
  names: Record<Side, string>;
  context: string;
  courtName: string | null;
};

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/** Viewer's match page: scoreboard, summary, live commentary, lead charts and stats. */
export function MatchCenter(props: Props) {
  const { tournamentId, backHref, backLabel, initial, initialEvents, names, context, courtName } = props;
  const [matches, setMatches] = React.useState<MatchWithGames[]>([initial]);
  const [events, setEvents] = React.useState(initialEvents);
  const [mounted, setMounted] = React.useState(false);
  const [keyOnly, setKeyOnly] = React.useState(false);
  const finished = isDone(initial);
  const connected = useLiveMatches(tournamentId, setMatches, !finished);
  const m = matches.find((x) => x.id === initial.id) ?? initial;

  // eslint-disable-next-line react-hooks/set-state-in-effect -- times render in the viewer's timezone after mount
  React.useEffect(() => setMounted(true), []);

  // When the match changes, fetch the commentary again (one small call, debounced).
  const version = m.version;
  React.useEffect(() => {
    if (version === initial.version) return;
    const id = setTimeout(async () => {
      const { data } = await createClient().rpc("match_commentary", { p_match_id: initial.id });
      if (data) setEvents(data as CommentaryEvent[]);
    }, 300);
    return () => clearTimeout(id);
  }, [version, initial.id, initial.version]);

  const lines = React.useMemo(() => buildCommentary(events, names, m.rules), [events, names, m.rules]);
  const stats = React.useMemo(() => matchStats(events, m.rules), [events, m.rules]);
  const summary = isDone(m) ? matchSummary(stats, names, m.winner_side, m.result_reason) : null;
  const call = callout(m, names);
  const live = m.status === "LIVE";
  const inPlay = live || m.status === "GAME_ENDED" || m.status === "MATCH_WON_PENDING";
  const bestOf = m.rules.best_of;

  // Commentary grouped by game, newest game first.
  const shown = keyOnly ? lines.filter(isKeyLine) : lines;
  const byGame = new Map<number, Line[]>();
  for (const l of shown) byGame.set(l.game, [...(byGame.get(l.game) ?? []), l]);
  const gameNumbers = [...byGame.keys()].sort((a, b) => b - a);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href={backHref} className="text-sm text-ink-soft hover:text-ink">
        Back to {backLabel}
      </Link>
      <p className="mt-3 text-sm text-ink-soft">
        {context}
        {courtName ? `, ${courtName}` : ""}
        {bestOf > 1 && inPlay ? `, game ${m.current_game} of ${bestOf}` : ""}
      </p>

      {/* Scoreboard */}
      <section aria-label="Score" className="mt-3 overflow-hidden rounded-lg border border-line">
        {(["A", "B"] as Side[]).map((side, i) => {
          const won = side === "A" ? m.games_won_a : m.games_won_b;
          const serving = live && m.serving_side === side;
          const winner = isDone(m) && m.winner_side === side;
          return (
            <div key={side} className={cn("flex items-center gap-3 px-4 py-4 sm:px-6", i === 1 && "border-t border-line")}>
              <span className={cn("h-8 w-1 shrink-0 rounded-full", side === "A" ? "bg-side-a" : "bg-side-b")} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-lg sm:text-xl", winner ? "font-bold" : "font-semibold")}>
                  {names[side]}
                  {winner && <span className="ml-2 text-sm font-semibold text-court">Winner</span>}
                </p>
                <p className="text-xs text-ink-soft">
                  {bestOf > 1 && `Games ${won}`}
                  {serving && `${bestOf > 1 ? ", " : ""}serving`}
                </p>
              </div>
              <div className="font-score flex items-baseline gap-3 text-ink-soft" aria-label="Game scores">
                {m.games
                  .filter((g) => g.game_number < m.current_game || !inPlay)
                  .map((g) => (
                    <span key={g.game_number} className={cn("text-2xl", g.winner_side === side && "text-ink")}>
                      {side === "A" ? g.score_a : g.score_b}
                    </span>
                  ))}
              </div>
              {inPlay && <span className="font-score w-[2ch] text-right text-6xl sm:text-7xl">{side === "A" ? m.score_a : m.score_b}</span>}
            </div>
          );
        })}
        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2 px-4 py-2 text-sm sm:px-6" aria-live="polite">
          <span className="font-semibold">
            {call ??
              (isDone(m)
                ? `${m.winner_side ? `${names[m.winner_side]} won` : "Match over"}${
                    m.result_reason && m.result_reason !== "NORMAL" ? ` (${REASON_LABEL[m.result_reason].toLowerCase()})` : ""
                  }`
                : live
                  ? `Game ${m.current_game} in play`
                  : STATUS_LABEL[m.status])}
          </span>
          {!finished && (
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-soft">
              <span className={cn("size-2 rounded-full", connected ? "bg-live" : "bg-warn")} aria-hidden="true" />
              {connected ? "Updating live" : "Connecting…"}
            </span>
          )}
        </div>
      </section>

      {summary && <p className="mt-6 text-lg leading-relaxed">{summary}</p>}

      {/* Commentary */}
      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl">Commentary</h2>
          {lines.length > 0 && (
            <div role="group" aria-label="Show" className="inline-grid grid-cols-2 rounded-md bg-surface-2 p-1 text-sm">
              {[
                { v: false, label: "Every rally" },
                { v: true, label: "Key moments" },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={keyOnly === o.v}
                  onClick={() => setKeyOnly(o.v)}
                  className={cn(
                    "rounded px-3 py-1.5 font-semibold",
                    keyOnly === o.v ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="mt-3 text-ink-soft">Commentary starts when the first rally is played.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {gameNumbers.map((g, i) => {
              const list = byGame.get(g)!;
              const body = <CommentaryList lines={list} mounted={mounted} />;
              const label = bestOf > 1 ? `Game ${g}` : "Match";
              return i === 0 ? (
                <section key={g} aria-label={label}>
                  {bestOf > 1 && <h3 className="mb-1 text-sm font-semibold text-ink-soft">{label}</h3>}
                  {body}
                </section>
              ) : (
                <details key={g} className="group">
                  <summary className="cursor-pointer py-1 text-sm font-semibold text-ink-soft hover:text-ink">
                    {label}, {list.length} {list.length === 1 ? "update" : "updates"}
                  </summary>
                  {body}
                </details>
              );
            })}
          </div>
        )}
      </section>

      {/* Momentum and stats */}
      {stats.rallies.length > 0 && (
        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-3xl">Momentum</h2>
            <SidesLegend names={names} />
          </div>
          <p className="mt-1 text-sm text-ink-soft">Who led, and by how much, after every rally.</p>
          <div className="mt-4 grid gap-6">
            {stats.games
              .slice()
              .reverse()
              .map((g) => (
                <LeadChart key={g.game} game={g.game} names={names} rallies={stats.rallies.filter((r) => r.game === g.game)} />
              ))}
          </div>
        </section>
      )}

      {stats.rallies.length > 0 && <StatsTable names={names} stats={stats} />}

      <div className="mt-12">
        <ShareLinks
          url={props.shareUrl}
          title={props.shareTitle}
          text={summary ? `${summary} Full commentary: ${props.shareUrl}` : undefined}
        />
      </div>
    </div>
  );
}

function CommentaryList({ lines, mounted }: { lines: Line[]; mounted: boolean }) {
  // Show the time only when the minute changes, so it marks the pace instead of repeating.
  const minuteOf = (i: number) => (mounted && lines[i] ? timeFmt.format(new Date(lines[i].at)) : "");
  return (
    <ol className="divide-y divide-line border-y border-line">
      {lines.map((l, i) => {
        const minute = minuteOf(i);
        const showTime = i === 0 || minute !== minuteOf(i - 1);
        return (
          <li key={l.key} className="flex items-baseline gap-4 py-2.5">
            <time dateTime={l.at} className="w-16 shrink-0 text-xs text-ink-soft tabular-nums" suppressHydrationWarning>
              {showTime ? minute : ""}
            </time>
            <p
              className={cn(
                "min-w-0 flex-1",
                l.tone === "result" && "font-semibold text-court",
                (l.tone === "moment" || l.tone === "swing") && "font-semibold",
                l.tone === "rally" && "text-ink-soft"
              )}
            >
              {l.text}
            </p>
            {l.score && <span className="font-score shrink-0 text-xl tabular-nums">{l.score}</span>}
          </li>
        );
      })}
    </ol>
  );
}

function StatsTable({ names, stats }: { names: Record<Side, string>; stats: ReturnType<typeof matchStats> }) {
  const pct = (won: number, of: number) => (of ? `${won} of ${of} (${Math.round((won / of) * 100)}%)` : "None");
  const lead = (s: SideStats) => (s.biggestLead ? `${s.biggestLead.lead} points, game ${s.biggestLead.game}` : "Never led");
  const rows: { label: string; get: (s: SideStats) => string }[] = [
    { label: "Points won", get: (s) => String(s.points) },
    { label: "Won while serving", get: (s) => pct(s.wonOnServe, s.servedRallies) },
    { label: "Won while receiving", get: (s) => pct(s.wonOnReceive, s.receivedRallies) },
    { label: "Longest run", get: (s) => `${s.longestRun} point${s.longestRun === 1 ? "" : "s"}` },
    { label: "Biggest lead", get: lead },
  ];
  return (
    <section className="mt-12">
      <h2 className="font-display text-3xl">Match stats</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 font-semibold text-ink-soft">
                <span className="sr-only">Stat</span>
              </th>
              {(["A", "B"] as Side[]).map((s) => (
                <th key={s} scope="col" className="py-2 font-semibold">
                  <span className={cn("mr-2 inline-block size-2.5 rounded-sm", s === "A" ? "bg-side-a" : "bg-side-b")} aria-hidden="true" />
                  {names[s]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-line">
                <th scope="row" className="py-2 pr-4 font-normal text-ink-soft">
                  {r.label}
                </th>
                <td className="py-2 pr-4">{r.get(stats.sides.A)}</td>
                <td className="py-2">{r.get(stats.sides.B)}</td>
              </tr>
            ))}
            {stats.games.map((g) => (
              <tr key={g.game} className="border-b border-line">
                <th scope="row" className="py-2 pr-4 font-normal text-ink-soft">
                  Game {g.game}
                  {g.minutes ? `, ${g.minutes} min` : g.winner ? "" : ", in play"}
                </th>
                <td className={cn("py-2 pr-4", g.winner === "A" && "font-semibold")}>{g.a}</td>
                <td className={cn("py-2", g.winner === "B" && "font-semibold")}>{g.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
