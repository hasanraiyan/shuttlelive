"use client";

import * as React from "react";
import { CourtLines, COURT } from "@/components/court/court-lines";
import { ScoreFlip } from "@/components/ui/score-flip";
import { cn } from "@/lib/utils";

type Side = "a" | "b";

type MatchState = {
  score: Record<Side, number>;
  games: Record<Side, number>;
  game: number;
  server: Side;
  winner: Side | null;
  log: string[];
};

const PLAYERS: Record<Side, { name: string; short: string; team: string }> = {
  a: { name: "Aman Kumar", short: "Aman", team: "Smash Academy" },
  b: { name: "Rahul Sharma", short: "Rahul", team: "Riverside BC" },
};

const START: MatchState = {
  score: { a: 18, b: 16 },
  games: { a: 1, b: 0 },
  game: 2,
  server: "a",
  winner: null,
  log: [
    "Aman wins a long rally at the net. 18–16",
    "Rahul smashes cross-court. 17–16",
    "Aman takes three points in a row. 17–15",
  ],
};

// BWF 3 × 21: rally to 21, win by two, capped at 30, interval at 11.
const wonGame = (mine: number, theirs: number) =>
  (mine >= 21 && mine - theirs >= 2) || mine === 30;

const other = (s: Side): Side => (s === "a" ? "b" : "a");

function rally(state: MatchState, side: Side): MatchState {
  const score = { ...state.score, [side]: state.score[side] + 1 };
  const p = PLAYERS[side];
  const line = `${p.short} wins the rally. ${score.a}–${score.b}`;
  const log = [line, ...state.log];

  if (score[side] === 11 && score[other(side)] < 11) {
    log.unshift(`Interval. ${p.short} leads ${score[side]}–${score[other(side)]}`);
  }

  if (!wonGame(score[side], score[other(side)])) {
    return { ...state, score, server: side, log: log.slice(0, 6) };
  }

  const games = { ...state.games, [side]: state.games[side] + 1 };
  log.unshift(`Game ${state.game} to ${p.short}, ${score[side]}–${score[other(side)]}`);

  if (games[side] === 2) {
    log.unshift(`${p.name} wins the match ${games[side]}–${games[other(side)]}`);
    return { ...state, score, games, server: side, winner: side, log: log.slice(0, 6) };
  }

  return {
    score: { a: 0, b: 0 },
    games,
    game: state.game + 1,
    server: side,
    winner: null,
    log: log.slice(0, 6),
  };
}

function statusFor(s: MatchState): string {
  if (s.winner) return `${PLAYERS[s.winner].name} wins the final`;
  const { a, b } = s.score;
  if (a === b && a >= 20) return `${a} all. Two clear points needed`;
  for (const side of ["a", "b"] as Side[]) {
    const mine = s.score[side];
    const theirs = s.score[other(side)];
    if ((mine >= 20 && mine > theirs) || mine === 29) {
      const match = s.games[side] === 1;
      return `${match ? "Match" : "Game"} point, ${PLAYERS[side].short}`;
    }
  }
  return `${PLAYERS[s.server].short} to serve`;
}

export function CourtScoreboard() {
  const [history, setHistory] = React.useState<MatchState[]>([START]);
  const state = history[history.length - 1];

  const award = (side: Side) => {
    if (state.winner) return;
    setHistory((h) => [...h, rally(h[h.length - 1], side)]);
  };
  const undo = () => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  const reset = () => setHistory([START]);

  // Even score serves from the right service court. Facing the net, the
  // left-hand player's right is the bottom box; the right-hand player's is the top.
  const serverScore = state.score[state.server];
  const even = serverScore % 2 === 0;
  const box =
    state.server === "a" ? (even ? "bottom" : "top") : even ? "top" : "bottom";
  const boxStyle = COURT.serviceBox(state.server === "a" ? "left" : "right", box);
  const status = statusFor(state);
  const urgent = /point|all/.test(status) && !state.winner;

  return (
    <div className="w-full rounded-xl border border-line bg-surface p-4 shadow-[0_30px_60px_-30px_color-mix(in_oklab,var(--ink)_30%,transparent)] sm:p-5">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <p className="font-semibold text-ink">
          Court 1 <span className="font-normal text-ink-soft">Men&apos;s singles final</span>
        </p>
        <p className="shrink-0 text-ink-soft">Game {state.game} of 3</p>
      </div>

      {/* Scoreboard: names and scores live here, never on the court */}
      <div className="mt-4 divide-y divide-line rounded-lg border border-line">
        {(["a", "b"] as Side[]).map((side) => {
          const p = PLAYERS[side];
          const serving = state.server === side && !state.winner;
          return (
            <div key={side} className="flex items-center gap-3 px-4 py-3">
              <span
                className={cn("size-2.5 shrink-0 rounded-full", serving ? "bg-live" : "bg-transparent")}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">
                  {p.name} <span className="font-normal text-ink-soft">{p.team}</span>
                </p>
                <p className="text-xs text-ink-soft">
                  {serving ? "Serving" : "Receiving"}, games won {state.games[side]}
                </p>
              </div>
              <ScoreFlip
                value={state.score[side]}
                minDigits={2}
                className="w-[2ch] justify-end text-6xl text-ink"
              />
            </div>
          );
        })}
      </div>

      {/* Court diagram: only shows which box the server is in */}
      <div
        className="relative mt-4 w-full overflow-hidden rounded-md bg-court"
        style={{ aspectRatio: COURT.aspect }}
        aria-hidden="true"
      >
        <div
          className="absolute bg-court-line/25 transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{
            left: `calc(4% + ${boxStyle.left} * 0.92)`,
            top: `calc(4% + ${boxStyle.top} * 0.92)`,
            width: `calc(${boxStyle.width} * 0.92)`,
            height: `calc(${boxStyle.height} * 0.92)`,
          }}
        />
        <CourtLines className="absolute inset-[4%] h-[92%] w-[92%]" />
        {state.winner && (
          <div className="absolute inset-0 flex items-center justify-center bg-court-deep/90 p-4 text-center">
            <p className="font-display text-3xl text-court-line">{PLAYERS[state.winner].name} wins</p>
          </div>
        )}
      </div>

      {/* Scoring controls */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {state.winner ? (
          <button
            type="button"
            onClick={reset}
            className="col-span-2 h-12 rounded-md bg-ink font-semibold text-surface hover:bg-court"
          >
            Play the final again
          </button>
        ) : (
          (["a", "b"] as Side[]).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => award(side)}
              className="h-12 rounded-md bg-court font-semibold text-court-line hover:bg-court-deep active:scale-[0.98] motion-reduce:active:scale-100"
            >
              +1 {PLAYERS[side].short}
            </button>
          ))
        )}
      </div>

      <div className="mt-4 flex items-start justify-between gap-4 border-t border-line pt-4">
        <div className="min-w-0">
          <p aria-live="polite" className={cn("w-fit text-sm font-semibold text-ink", urgent && "rounded-md bg-warn/20 px-2 py-0.5")}>
            <span className="sr-only">
              Score {PLAYERS.a.short} {state.score.a}, {PLAYERS.b.short} {state.score.b}.{" "}
            </span>
            {status}
          </p>
          <ol className="mt-1.5 space-y-0.5 text-sm text-ink-soft">
            {state.log.slice(0, 2).map((line, i) => (
              <li key={`${history.length}-${i}`} className="truncate">
                {line}
              </li>
            ))}
          </ol>
        </div>
        <button
          type="button"
          onClick={undo}
          disabled={history.length <= 1}
          className="shrink-0 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:border-warn disabled:opacity-40 disabled:hover:border-line"
        >
          Undo
        </button>
      </div>
    </div>
  );
}
