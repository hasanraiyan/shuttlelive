"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Notice } from "@/components/app/ui";
import { ScoreFlip } from "@/components/ui/score-flip";
import { scoreMatch } from "@/lib/actions/scoring";
import { applyNextGame, applyPoint, restSeconds } from "@/lib/engine";
import { createClient } from "@/lib/supabase/client";
import { REASON_LABEL, callout, serviceCourt } from "@/lib/scoring";
import type { MatchCommand, MatchWithGames, Side } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  tid: string;
  initial: MatchWithGames;
  /** The shared dashboard copy of this match, kept current by Realtime. */
  external: MatchWithGames;
  /** Reports each server-confirmed state back to the shared dashboard data. */
  onMatch: (m: MatchWithGames) => void;
  names: Record<Side, string>;
  context: string;
  courtName: string | null;
};

/** A command waiting to reach the server. Version is what the server should be at when it arrives. */
type Queued = { command: "POINT" | "NEXT_GAME" | "UNDO"; side?: Side; id: string; expectedVersion: number };
type Direct = { command: "START" | "CONFIRM" | "TERMINATE"; side?: Side; reason?: "WALKOVER" | "RETIREMENT" | "DISQUALIFICATION" };

const storageKey = (matchId: string) => `shuttlelive:queue:${matchId}`;

function loadQueue(matchId: string): Queued[] {
  try {
    const raw = window.localStorage.getItem(storageKey(matchId));
    const parsed = raw ? (JSON.parse(raw) as Queued[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(matchId: string, queue: Queued[]) {
  try {
    if (queue.length) window.localStorage.setItem(storageKey(matchId), JSON.stringify(queue));
    else window.localStorage.removeItem(storageKey(matchId));
  } catch {
    /* storage blocked: the queue still lives in memory */
  }
}

const sortGames = (m: MatchWithGames): MatchWithGames => ({
  ...m,
  games: [...(m.games ?? [])].sort((a, b) => a.game_number - b.game_number),
});

export function ScoreConsole({ tid, initial, external, onMatch, names, context, courtName }: Props) {
  // What the screen shows: the server's state plus any queued commands applied on top.
  const [match, setMatch] = React.useState(() => sortGames(initial));
  const [queue, setQueue] = React.useState<Queued[]>([]);
  const [offline, setOffline] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [locked, setLocked] = React.useState(false); // restored queue that can't be shown optimistically
  const [error, setError] = React.useState<string | null>(null);

  const queueRef = React.useRef<Queued[]>([]);
  const onMatchRef = React.useRef(onMatch);
  React.useEffect(() => {
    onMatchRef.current = onMatch;
  }, [onMatch]);
  /** A state the server confirmed: show it and share it with the other tabs. */
  const confirmed = React.useCallback((m: MatchWithGames) => {
    const sorted = sortGames(m);
    setMatch(sorted);
    onMatchRef.current(sorted);
  }, []);
  const historyRef = React.useRef<MatchWithGames[]>([]); // states before each local command, for offline undo
  const flushing = React.useRef(false);
  const supabase = React.useMemo(() => createClient(), []);

  const setQueueBoth = React.useCallback(
    (q: Queued[]) => {
      queueRef.current = q;
      setQueue(q);
      saveQueue(initial.id, q);
    },
    [initial.id]
  );

  const reload = React.useCallback(async () => {
    const { data } = await supabase
      .from("matches")
      .select("*, games:match_games(game_number, score_a, score_b, winner_side)")
      .eq("id", initial.id)
      .single();
    if (data) confirmed(data as MatchWithGames);
  }, [supabase, initial.id, confirmed]);

  // Send queued commands one at a time, in order.
  const flush = React.useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      while (queueRef.current.length) {
        const head = queueRef.current[0];
        let res;
        try {
          res = await scoreMatch({
            tournamentId: tid,
            matchId: initial.id,
            command: head.command,
            expectedVersion: head.expectedVersion,
            clientEventId: head.id,
            side: head.side,
          });
        } catch {
          setOffline(true);
          return; // keep the queue; retried when the connection returns
        }
        setOffline(false);
        if (!res.ok) {
          const lost = queueRef.current.length;
          setQueueBoth([]);
          setLocked(false);
          historyRef.current = [];
          setError(
            res.conflict
              ? `The score changed on another device, so ${lost} unsent tap${lost === 1 ? " was" : "s were"} discarded. Check the score below.`
              : res.error
          );
          await reload();
          return;
        }
        const rest = queueRef.current.slice(1);
        setQueueBoth(rest);
        if (!rest.length) {
          if (res.data) confirmed(res.data);
          setLocked(false);
        }
      }
    } finally {
      flushing.current = false;
    }
  }, [tid, initial.id, reload, setQueueBoth, confirmed]);

  // Restore anything left from a refresh or a dropped connection.
  React.useEffect(() => {
    const saved = loadQueue(initial.id);
    if (!saved.length) return;
    queueRef.current = saved;
    // localStorage only exists after mount, so the restore has to happen in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQueue(saved);

    // Rebuild what the screen should show: server state plus taps it hasn't seen yet.
    let view = sortGames(initial);
    let rebuilt = true;
    for (const q of saved) {
      if (q.expectedVersion < view.version) continue; // already applied on the server
      if (q.expectedVersion !== view.version) { rebuilt = false; break; }
      if (q.command === "POINT" && q.side) view = applyPoint(view, q.side);
      else if (q.command === "NEXT_GAME") view = applyNextGame(view);
      else { rebuilt = false; break; }
    }
    if (rebuilt) {
      setMatch(view);
      void flush();
    } else {
      // Can't safely show an optimistic score: lock scoring until the queue is sent.
      setLocked(true);
      void flush();
    }
    // Run once per match on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id]);

  // Retry when the browser comes back online, and every few seconds while offline.
  React.useEffect(() => {
    const retry = () => void flush();
    window.addEventListener("online", retry);
    const timer = setInterval(() => {
      if (queueRef.current.length) retry();
    }, 5000);
    return () => {
      window.removeEventListener("online", retry);
      clearInterval(timer);
    };
  }, [flush]);

  // Changes from another tab or device arrive through the shared dashboard data
  // (one Realtime subscription for the whole tournament). Adopt them only when
  // nothing local is pending, so they never overwrite unsent taps.
  React.useEffect(() => {
    if (queueRef.current.length || flushing.current) return;
    setMatch((cur) => {
      if (external.version <= cur.version) return cur;
      historyRef.current = [];
      return sortGames(external);
    });
  }, [external]);

  /** Point, next game and undo: shown instantly, then queued for the server. */
  const enqueue = (command: Queued["command"], side?: Side) => {
    setError(null);
    let next: MatchWithGames | null = null;
    if (command === "POINT" && side) next = applyPoint(match, side);
    if (command === "NEXT_GAME") next = applyNextGame(match);
    if (command === "UNDO") {
      const prev = historyRef.current.pop();
      if (!prev) {
        // Nothing local to rewind: undo needs the server's record.
        void sendDirectUndo();
        return;
      }
      next = { ...prev, version: match.version + 1 };
    } else if (next) {
      historyRef.current.push(match);
    }
    if (!next || next === match) return;
    setMatch(next);
    setQueueBoth([...queueRef.current, { command, side, id: crypto.randomUUID(), expectedVersion: match.version }]);
    void flush();
  };

  const sendDirectUndo = async () => {
    if (queueRef.current.length) return;
    setBusy(true);
    try {
      const res = await scoreMatch({
        tournamentId: tid,
        matchId: match.id,
        command: "UNDO",
        expectedVersion: match.version,
        clientEventId: crypto.randomUUID(),
      });
      if (res.ok && res.data) confirmed(res.data);
      else if (!res.ok) {
        setError(res.error);
        if (res.conflict) await reload();
      }
    } catch {
      setError("Undo needs a connection when the point was scored on another device or before a refresh.");
    } finally {
      setBusy(false);
    }
  };

  /** Start, confirm and early finishes need the server right away. */
  const direct = async (c: Direct) => {
    if (queueRef.current.length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await scoreMatch({
        tournamentId: tid,
        matchId: match.id,
        command: c.command as MatchCommand,
        expectedVersion: match.version,
        clientEventId: crypto.randomUUID(),
        side: c.side,
        reason: c.reason,
      });
      if (res.ok && res.data) {
        historyRef.current = [];
        confirmed(res.data);
      } else if (!res.ok) {
        setError(res.error);
        if (res.conflict) await reload();
      }
    } catch {
      setError("This needs a connection. Check your signal and try again.");
    } finally {
      setBusy(false);
    }
  };

  const m = match;
  const live = m.status === "LIVE";
  const call = callout(m, names);
  const court = serviceCourt(m);
  const finished = m.status === "FINALIZED" || m.status === "TERMINATED";
  const bestOf = m.rules.best_of;
  const pending = queue.length;
  const rest = restSeconds(m);
  const restKey = `${m.status}-${m.current_game}-${m.score_a}-${m.score_b}`;

  return (
    <div className="mx-auto max-w-3xl pb-20">
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

      {/* Save status: a fixed-size slot, so nothing above the score buttons ever moves. */}
      <SaveStatus pending={pending} offline={offline} />

      {/* Scoreboard: each half is the button for that side */}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:gap-3">
        {(["A", "B"] as Side[]).map((side) => {
          const score = side === "A" ? m.score_a : m.score_b;
          const games = side === "A" ? m.games_won_a : m.games_won_b;
          const serving = m.serving_side === side && live;
          return (
            <button
              key={side}
              type="button"
              disabled={!live || busy || locked}
              onClick={() => enqueue("POINT", side)}
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
              <ScoreFlip
                value={score}
                className="text-[clamp(5.5rem,22vw,10rem)]"
              />
              <span className="h-5 text-sm font-medium">{serving ? `Serving, ${court} court` : live ? "+1" : ""}</span>
            </button>
          );
        })}
      </div>

      {/* Fixed-height row for the call and the rest timer, so Undo below never moves. */}
      <div className="mt-3 flex h-16 items-center justify-center gap-3 overflow-hidden">
      <div aria-live="polite" className="text-center font-semibold">
        <span className="sr-only">
          {names.A} {m.score_a}, {names.B} {m.score_b}.
        </span>
        {call && <span className={live ? "rounded-md bg-warn/20 px-2 py-0.5 text-ink" : "text-ink"}>{call}</span>}
        {finished && (
          <span>
            {m.winner_side ? `${names[m.winner_side]} won` : "Match over"}
            {m.result_reason && m.result_reason !== "NORMAL" ? ` (${REASON_LABEL[m.result_reason].toLowerCase()})` : ""}
          </span>
        )}
      </div>
      {rest && <RestTimer key={restKey} seconds={rest} label={rest === 60 ? "Interval" : "Break between games"} />}
      </div>

      {offline && pending > 0 && (
        <p
          role="status"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-warn bg-surface px-4 py-3 text-center text-sm font-semibold text-ink shadow-[0_-8px_24px_-12px_var(--ink)]"
        >
          <span className="mr-2 inline-block size-2 rounded-full bg-warn align-middle" aria-hidden="true" />
          No connection. {pending} tap{pending === 1 ? " is" : "s are"} saved on this phone and will be sent when you&apos;re back
          online. Keep scoring.
        </p>
      )}

      {/* Context actions */}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {m.status === "SCHEDULED" && (
          <>
            <p className="w-full text-center text-sm text-ink-soft">Who serves first?</p>
            {(["A", "B"] as Side[]).map((side) => (
              <Button key={side} size="lg" disabled={busy} onClick={() => direct({ command: "START", side })}>
                {names[side]}
              </Button>
            ))}
          </>
        )}
        {m.status === "GAME_ENDED" && (
          <Button size="lg" disabled={busy || locked} onClick={() => enqueue("NEXT_GAME")}>
            Start game {m.current_game + 1}
          </Button>
        )}
        {m.status === "MATCH_WON_PENDING" && (
          <Button size="lg" disabled={busy || pending > 0} onClick={() => direct({ command: "CONFIRM" })}>
            {pending > 0 ? "Saving taps first…" : "Confirm result"}
          </Button>
        )}
        {(live || m.status === "GAME_ENDED" || m.status === "MATCH_WON_PENDING") && (
          <Button
            size="lg"
            variant="secondary"
            className="border-warn text-ink hover:bg-warn/10"
            disabled={busy || locked}
            onClick={() => enqueue("UNDO")}
          >
            Undo last point
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {m.games.length > 0 && (
        <table className="mx-auto mt-8 text-sm">
          <caption className="mb-2 text-ink-soft">Games</caption>
          <tbody>
            {(["A", "B"] as Side[]).map((side) => (
              <tr key={side}>
                <th scope="row" className="pr-4 text-left font-medium">
                  {names[side]}
                </th>
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
                  <p className="mb-2 font-semibold">
                    {names[winner]} wins because {names[loser]}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {m.status === "SCHEDULED" && (
                      <EndButton
                        label="didn't turn up"
                        confirm={`Give ${names[winner]} a walkover?`}
                        busy={busy || pending > 0}
                        onConfirm={() => direct({ command: "TERMINATE", side: winner, reason: "WALKOVER" })}
                      />
                    )}
                    {m.status !== "SCHEDULED" && (
                      <EndButton
                        label="retired"
                        confirm={`${names[loser]} retired. End the match?`}
                        busy={busy || pending > 0}
                        onConfirm={() => direct({ command: "TERMINATE", side: winner, reason: "RETIREMENT" })}
                      />
                    )}
                    <EndButton
                      label="was disqualified"
                      confirm={`Disqualify ${names[loser]}?`}
                      busy={busy || pending > 0}
                      onConfirm={() => direct({ command: "TERMINATE", side: winner, reason: "DISQUALIFICATION" })}
                    />
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

/** Countdown for the interval (60 s) or the break between games (120 s). It never blocks scoring. */
function RestTimer({ seconds, label }: { seconds: number; label: string }) {
  const [left, setLeft] = React.useState(seconds);
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      const remaining = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(remaining);
      if (remaining === 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [seconds]);

  if (hidden) return null;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  const warning = left <= 20 && left > 0;
  return (
    <div className="flex shrink-0 items-center gap-1">
      <p
        role="timer"
        aria-label={`${label}, ${left} seconds left`}
        className={cn(
          "rounded-md px-3 py-1 text-center whitespace-nowrap",
          left === 0 ? "bg-warn/20" : warning ? "bg-warn/15" : "bg-surface-2"
        )}
      >
        <span className="text-sm text-ink-soft">{left === 0 ? `${label} over` : label}</span>{" "}
        <span className="font-score text-2xl tabular-nums">
          {mm}:{ss}
        </span>
      </p>
      <Button size="sm" variant="ghost" aria-label="Hide timer" onClick={() => setHidden(true)}>
        ×
      </Button>
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

/**
 * "Saved" / "Saving…" indicator in a fixed-height slot. "Saving…" only appears
 * if a save takes longer than a moment, so normal taps don't flicker it.
 */
function SaveStatus({ pending, offline }: { pending: number; offline: boolean }) {
  const [slow, setSlow] = React.useState(false);
  React.useEffect(() => {
    if (!pending) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the delayed indicator
      setSlow(false);
      return;
    }
    const id = setTimeout(() => setSlow(true), 700);
    return () => clearTimeout(id);
  }, [pending]);

  const label = offline && pending ? `${pending} waiting to send` : pending && slow ? "Saving…" : "All changes saved";
  const dot = offline && pending ? "bg-warn" : pending && slow ? "bg-ink-soft animate-pulse motion-reduce:animate-none" : "bg-live";
  return (
    <p role="status" aria-live="polite" className="mt-2 flex h-5 items-center justify-end gap-1.5 text-xs text-ink-soft">
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden="true" />
      {label}
    </p>
  );
}
