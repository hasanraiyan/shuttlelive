"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Notice } from "@/components/app/ui";
import { scoreMatch } from "@/lib/actions/scoring";
import { createClient } from "@/lib/supabase/client";
import { REASON_LABEL, callout, serviceCourt } from "@/lib/scoring";
import type { MatchCommand, MatchWithGames, Side } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  tid: string;
  initial: MatchWithGames;
  names: Record<Side, string>;
  context: string;
  courtName: string | null;
};

type Pending = { command: MatchCommand; side?: Side; reason?: "WALKOVER" | "RETIREMENT" | "DISQUALIFICATION"; id: string };

export function ScoreConsole({ tid, initial, names, context, courtName }: Props) {
  const [match, setMatch] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [retry, setRetry] = React.useState<Pending | null>(null);
  const supabase = React.useMemo(() => createClient(), []);

  const reload = React.useCallback(async () => {
    const { data } = await supabase
      .from("matches")
      .select("*, games:match_games(game_number, score_a, score_b, winner_side)")
      .eq("id", initial.id)
      .single();
    if (data) {
      const m = data as MatchWithGames;
      m.games.sort((a, b) => a.game_number - b.game_number);
      setMatch(m);
    }
  }, [supabase, initial.id]);

  // Another tab or device scoring this match keeps this screen current.
  React.useEffect(() => {
    const channel = supabase
      .channel(`match-${initial.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${initial.id}` }, (p) => {
        const next = p.new as MatchWithGames;
        setMatch((cur) => (next.version > cur.version ? { ...cur, ...next, games: cur.games } : cur));
        void reload();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, initial.id, reload]);

  const send = React.useCallback(
    async (p: Pending) => {
      setBusy(true);
      setError(null);
      try {
        const res = await scoreMatch({
          tournamentId: tid,
          matchId: match.id,
          command: p.command,
          expectedVersion: match.version,
          clientEventId: p.id,
          side: p.side,
          reason: p.reason,
        });
        if (res.ok && res.data) {
          const m = res.data;
          m.games.sort((a, b) => a.game_number - b.game_number);
          setMatch(m);
          setRetry(null);
        } else if (!res.ok) {
          setError(res.error);
          setRetry(null);
          if (res.conflict) await reload();
        }
      } catch {
        // Network failure: keep the same event id so a retry can never double count.
        setRetry(p);
        setError("Couldn't reach the server. Check your connection and try again.");
      } finally {
        setBusy(false);
      }
    },
    [tid, match.id, match.version, reload]
  );

  const run = (command: MatchCommand, extra: Omit<Pending, "command" | "id"> = {}) =>
    send({ command, id: crypto.randomUUID(), ...extra });

  const m = match;
  const live = m.status === "LIVE";
  const call = callout(m, names);
  const court = serviceCourt(m);
  const finished = m.status === "FINALIZED" || m.status === "TERMINATED";
  const bestOf = m.rules.best_of;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <Link href={`/dashboard/t/${tid}`} className="text-ink-soft hover:text-ink">
          Back to matches
        </Link>
        <p className="text-ink-soft">
          {context}
          {courtName ? `, ${courtName}` : ""}
          {bestOf > 1 && !finished && m.status !== "SCHEDULED" ? `, game ${m.current_game} of ${bestOf}` : ""}
        </p>
      </div>

      {/* Scoreboard: each half is the button for that side */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
        {(["A", "B"] as Side[]).map((side) => {
          const score = side === "A" ? m.score_a : m.score_b;
          const games = side === "A" ? m.games_won_a : m.games_won_b;
          const serving = m.serving_side === side && live;
          return (
            <button
              key={side}
              type="button"
              disabled={!live || busy}
              onClick={() => run("POINT", { side })}
              aria-label={`Point to ${names[side]}`}
              className={cn(
                "flex min-h-[15rem] flex-col items-center justify-between rounded-lg p-3 text-center sm:min-h-[19rem] sm:p-5",
                live ? "bg-court text-court-line active:bg-court-deep" : "bg-surface-2 text-ink",
                "disabled:cursor-default enabled:hover:bg-court-deep"
              )}
            >
              <span className="w-full">
                <span className="block truncate text-base font-semibold sm:text-lg">{names[side]}</span>
                {bestOf > 1 && (
                  <span className="mt-1 flex justify-center gap-1" aria-label={`${games} games won`}>
                    {Array.from({ length: Math.floor(bestOf / 2) + 1 }, (_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "size-2.5 rounded-full border",
                          live ? "border-court-line" : "border-ink-soft",
                          i < games && (live ? "bg-court-line" : "bg-ink-soft")
                        )}
                      />
                    ))}
                  </span>
                )}
              </span>
              <span className="font-score text-[clamp(5.5rem,22vw,10rem)]" aria-hidden="true">
                {score}
              </span>
              <span className="h-5 text-sm font-medium">
                {serving ? `Serving, ${court} court` : live ? "+1" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="mt-4 min-h-6 text-center font-semibold">
        <span className="sr-only">
          {names.A} {m.score_a}, {names.B} {m.score_b}.
        </span>
        {call && <span className={m.status === "LIVE" ? "text-warn" : "text-ink"}>{call}</span>}
        {finished && (
          <span>
            {m.winner_side ? `${names[m.winner_side]} won` : "Match over"}
            {m.result_reason && m.result_reason !== "NORMAL" ? ` (${REASON_LABEL[m.result_reason].toLowerCase()})` : ""}
          </span>
        )}
      </div>

      {error && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Notice tone="error">{error}</Notice>
          {retry && (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => send(retry)}>
              Try again
            </Button>
          )}
        </div>
      )}

      {/* Context actions */}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {m.status === "SCHEDULED" && (
          <>
            <p className="w-full text-center text-sm text-ink-soft">Who serves first?</p>
            {(["A", "B"] as Side[]).map((side) => (
              <Button key={side} size="lg" disabled={busy} onClick={() => run("START", { side })}>
                {names[side]}
              </Button>
            ))}
          </>
        )}
        {m.status === "GAME_ENDED" && (
          <Button size="lg" disabled={busy} onClick={() => run("NEXT_GAME")}>
            Start game {m.current_game + 1}
          </Button>
        )}
        {m.status === "MATCH_WON_PENDING" && (
          <Button size="lg" disabled={busy} onClick={() => run("CONFIRM")}>
            Confirm result
          </Button>
        )}
        {(live || m.status === "GAME_ENDED" || m.status === "MATCH_WON_PENDING") && (
          <Button
            size="lg"
            variant="secondary"
            className="border-warn text-ink hover:bg-warn/10"
            disabled={busy}
            onClick={() => run("UNDO")}
          >
            Undo last point
          </Button>
        )}
      </div>

      {m.games.length > 0 && (
        <table className="mx-auto mt-8 text-sm">
          <caption className="mb-2 text-ink-soft">Games</caption>
          <tbody>
            {(["A", "B"] as Side[]).map((side) => (
              <tr key={side}>
                <th scope="row" className="pr-4 text-left font-medium">{names[side]}</th>
                {m.games.map((g) => (
                  <td key={g.game_number} className={cn("font-score px-2 text-xl", g.winner_side === side && "text-court")}>
                    {side === "A" ? g.score_a : g.score_b}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!finished && m.status !== "MATCH_WON_PENDING" && (
        <details className="mt-10 border-t border-line pt-4 text-sm">
          <summary className="cursor-pointer font-semibold text-ink-soft">End the match early</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(["A", "B"] as Side[]).map((winner) => {
              const loser = winner === "A" ? "B" : "A";
              return (
                <div key={winner} className="rounded-md border border-line p-3">
                  <p className="mb-2 font-semibold">{names[winner]} wins because {names[loser]}</p>
                  <div className="flex flex-wrap gap-2">
                    {m.status === "SCHEDULED" && (
                      <EndButton label="didn't turn up" onConfirm={() => run("TERMINATE", { side: winner, reason: "WALKOVER" })} confirm={`Give ${names[winner]} a walkover?`} busy={busy} />
                    )}
                    {m.status !== "SCHEDULED" && (
                      <EndButton label="retired" onConfirm={() => run("TERMINATE", { side: winner, reason: "RETIREMENT" })} confirm={`${names[loser]} retired. End the match?`} busy={busy} />
                    )}
                    <EndButton label="was disqualified" onConfirm={() => run("TERMINATE", { side: winner, reason: "DISQUALIFICATION" })} confirm={`Disqualify ${names[loser]}?`} busy={busy} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-ink-soft">The result is final and the winner moves on. No score is invented for these results.</p>
        </details>
      )}
    </div>
  );
}

function EndButton({ label, confirm, onConfirm, busy }: { label: string; confirm: string; onConfirm: () => void; busy: boolean }) {
  return (
    <Button size="sm" variant="danger" disabled={busy} onClick={() => window.confirm(confirm) && onConfirm()}>
      {label}
    </Button>
  );
}
