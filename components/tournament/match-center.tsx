"use client";

import * as React from "react";
import Link from "next/link";
import { buildCommentary } from "@/lib/commentary";
import { useLiveMatches } from "@/lib/live";
import { REASON_LABEL, STATUS_LABEL, callout, isDone } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/client";
import type { CommentaryEvent, MatchWithGames, Side } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  tournamentId: string;
  backHref: string;
  backLabel: string;
  initial: MatchWithGames;
  initialEvents: CommentaryEvent[];
  names: Record<Side, string>;
  context: string;
  courtName: string | null;
};

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/** Viewer's match page: big scoreboard plus live, fact-based commentary. */
export function MatchCenter({ tournamentId, backHref, backLabel, initial, initialEvents, names, context, courtName }: Props) {
  const [matches, setMatches] = React.useState<MatchWithGames[]>([initial]);
  const [events, setEvents] = React.useState(initialEvents);
  const [mounted, setMounted] = React.useState(false);
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
  const call = callout(m, names);
  const live = m.status === "LIVE";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href={backHref} className="text-sm text-ink-soft hover:text-ink">
        Back to {backLabel}
      </Link>
      <p className="mt-3 text-sm text-ink-soft">
        {context}
        {courtName ? `, ${courtName}` : ""}
      </p>

      {/* Scoreboard */}
      <section aria-label="Score" className="mt-3 overflow-hidden rounded-lg border border-line">
        {(["A", "B"] as Side[]).map((side, i) => {
          const won = side === "A" ? m.games_won_a : m.games_won_b;
          const serving = live && m.serving_side === side;
          const winner = isDone(m) && m.winner_side === side;
          return (
            <div key={side} className={cn("flex items-center gap-3 px-4 py-4 sm:px-6", i === 1 && "border-t border-line")}>
              <span className={cn("size-2.5 shrink-0 rounded-full", serving ? "bg-live" : "bg-transparent")} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-lg sm:text-xl", winner ? "font-bold" : "font-semibold")}>{names[side]}</p>
                {serving && <p className="text-xs text-ink-soft">Serving</p>}
              </div>
              <div className="font-score flex items-baseline gap-3 text-ink-soft">
                {m.games
                  .filter((g) => g.game_number < m.current_game || !live)
                  .map((g) => (
                    <span key={g.game_number} className={cn("text-2xl", g.winner_side === side && "text-ink")}>
                      {side === "A" ? g.score_a : g.score_b}
                    </span>
                  ))}
                {m.rules.best_of > 1 && <span className="text-base">({won})</span>}
              </div>
              {(live || m.status === "GAME_ENDED" || m.status === "MATCH_WON_PENDING") && (
                <span className="font-score w-[2ch] text-right text-6xl sm:text-7xl">{side === "A" ? m.score_a : m.score_b}</span>
              )}
            </div>
          );
        })}
        <p className="border-t border-line bg-surface-2 px-4 py-2 text-sm sm:px-6" aria-live="polite">
          {call ? (
            <span className="font-semibold text-ink">{call}</span>
          ) : isDone(m) ? (
            <span className="font-semibold">
              {m.winner_side ? `${names[m.winner_side]} won` : "Match over"}
              {m.result_reason && m.result_reason !== "NORMAL" ? ` (${REASON_LABEL[m.result_reason].toLowerCase()})` : ""}
            </span>
          ) : (
            <span className="text-ink-soft">{STATUS_LABEL[m.status]}</span>
          )}
          {!finished && (
            <span className="float-right flex items-center gap-1.5 text-xs text-ink-soft">
              <span className={cn("size-2 rounded-full", connected ? "bg-live" : "bg-warn")} aria-hidden="true" />
              {connected ? "Live" : "Connecting…"}
            </span>
          )}
        </p>
      </section>

      {/* Commentary */}
      <section className="mt-10">
        <h2 className="font-display text-3xl">Commentary</h2>
        {lines.length === 0 ? (
          <p className="mt-3 text-ink-soft">Commentary starts when the first rally is played.</p>
        ) : (
          <ol className="mt-4 divide-y divide-line border-y border-line">
            {lines.map((l) => (
              <li key={l.key} className="flex items-baseline gap-4 py-2.5">
                <time dateTime={l.at} className="w-16 shrink-0 text-xs text-ink-soft tabular-nums" suppressHydrationWarning>
                  {mounted ? timeFmt.format(new Date(l.at)) : ""}
                </time>
                <p
                  className={cn(
                    "min-w-0 flex-1",
                    l.tone === "result" && "font-semibold text-court",
                    l.tone === "moment" && "font-semibold",
                    l.tone === "rally" && "text-ink-soft"
                  )}
                >
                  {l.text}
                </p>
                {l.score && <span className="font-score shrink-0 text-xl tabular-nums">{l.score}</span>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
