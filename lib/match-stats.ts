import type { CommentaryEvent, Rules, Side } from "@/lib/types";

/** One rally, replayed from the match log. Scores are after the rally. */
export type Rally = { game: number; n: number; a: number; b: number; winner: Side; server: Side | null; at: string };

export type SideStats = {
  points: number;
  servedRallies: number;
  wonOnServe: number;
  receivedRallies: number;
  wonOnReceive: number;
  longestRun: number;
  biggestLead: { lead: number; game: number; a: number; b: number } | null;
  /** Largest deficit this side overturned to take the lead within a game. */
  comeback: { from: number; game: number; downA: number; downB: number } | null;
};

export type GameSummary = { game: number; a: number; b: number; winner: Side | null; minutes: number | null };

export type MatchStats = {
  rallies: Rally[];
  games: GameSummary[];
  sides: Record<Side, SideStats>;
  minutes: number | null;
};

const empty = (): SideStats => ({
  points: 0,
  servedRallies: 0,
  wonOnServe: 0,
  receivedRallies: 0,
  wonOnReceive: 0,
  longestRun: 0,
  biggestLead: null,
  comeback: null,
});

const mins = (from: string, to: string) => Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 60000));

export function matchStats(events: CommentaryEvent[], rules: Rules): MatchStats {
  const sides: Record<Side, SideStats> = { A: empty(), B: empty() };
  const rallies: Rally[] = [];
  const games: GameSummary[] = [];
  let server: Side | null = null;
  let run: { side: Side | null; n: number } = { side: null, n: 0 };
  let gameStart: string | null = null;
  let matchStart: string | null = null;
  let lastAt: string | null = null;
  // Worst deficit seen so far in the current game, per side.
  let worst: Record<Side, { by: number; a: number; b: number }> = { A: { by: 0, a: 0, b: 0 }, B: { by: 0, a: 0, b: 0 } };
  let n = 0;

  for (const e of events) {
    lastAt = e.at;
    if (e.command === "START") {
      server = e.side;
      gameStart = matchStart = e.at;
      continue;
    }
    if (e.command === "NEXT_GAME") {
      gameStart = e.at;
      n = 0;
      run = { side: null, n: 0 }; // runs are counted within a game
      worst = { A: { by: 0, a: 0, b: 0 }, B: { by: 0, a: 0, b: 0 } };
      continue;
    }
    if (e.command !== "POINT" || !e.side) continue;

    const X = e.side;
    const a = e.a + (X === "A" ? 1 : 0);
    const b = e.b + (X === "B" ? 1 : 0);
    n += 1;
    rallies.push({ game: e.game, n, a, b, winner: X, server, at: e.at });

    sides[X].points += 1;
    if (server) {
      const receiver: Side = server === "A" ? "B" : "A";
      sides[server].servedRallies += 1;
      sides[receiver].receivedRallies += 1;
      if (X === server) sides[X].wonOnServe += 1;
      else sides[X].wonOnReceive += 1;
    }
    server = X; // the rally winner serves next

    run = run.side === X ? { side: X, n: run.n + 1 } : { side: X, n: 1 };
    sides[X].longestRun = Math.max(sides[X].longestRun, run.n);

    const lead = X === "A" ? a - b : b - a;
    const best = sides[X].biggestLead;
    if (lead > 0 && (!best || lead > best.lead)) sides[X].biggestLead = { lead, game: e.game, a, b };

    for (const s of ["A", "B"] as Side[]) {
      const deficit = s === "A" ? b - a : a - b;
      if (deficit > worst[s].by) worst[s] = { by: deficit, a, b };
    }
    // X just went ahead: record a comeback if they had been well behind.
    if (lead === 1 && worst[X].by >= 3) {
      const cb = sides[X].comeback;
      if (!cb || worst[X].by > cb.from) sides[X].comeback = { from: worst[X].by, game: e.game, downA: worst[X].a, downB: worst[X].b };
    }

    const mine = X === "A" ? a : b;
    const theirs = X === "A" ? b : a;
    if ((mine >= rules.points && mine - theirs >= 2) || mine >= rules.cap) {
      games.push({ game: e.game, a, b, winner: X, minutes: gameStart ? mins(gameStart, e.at) : null });
    }
  }

  // The game in progress, if any.
  const last = rallies.at(-1);
  if (last && !games.some((g) => g.game === last.game)) {
    games.push({ game: last.game, a: last.a, b: last.b, winner: null, minutes: null });
  }

  return { rallies, games, sides, minutes: matchStart && lastAt ? mins(matchStart, lastAt) : null };
}

/** A one-paragraph result summary, from facts only. */
export function matchSummary(
  stats: MatchStats,
  names: Record<Side, string>,
  winner: Side | null,
  reason: string | null
): string | null {
  if (!winner) return null;
  const loser: Side = winner === "A" ? "B" : "A";
  if (reason && reason !== "NORMAL") {
    const why =
      reason === "WALKOVER"
        ? `${names[loser]} conceded a walkover`
        : reason === "RETIREMENT"
          ? `${names[loser]} retired from the match`
          : `${names[loser]} was disqualified`;
    const lastRally = stats.rallies.at(-1);
    const scoreDetail = lastRally ? ` in game ${lastRally.game} (score was ${lastRally.a}–${lastRally.b})` : "";
    return `${names[winner]} was awarded the match after ${why}${scoreDetail}.`;
  }
  const scores = stats.games
    .filter((g) => g.winner)
    .map((g) => (winner === "A" ? `${g.a}–${g.b}` : `${g.b}–${g.a}`))
    .join(", ");
  let text = `${names[winner]} beat ${names[loser]} ${scores}${stats.minutes ? ` in ${stats.minutes} minutes` : ""}.`;
  const cb = stats.sides[winner].comeback;
  if (cb && cb.from >= 4) {
    const down = winner === "A" ? `${cb.downA}–${cb.downB}` : `${cb.downB}–${cb.downA}`;
    text += ` ${names[winner]} came back from ${down} down in game ${cb.game}.`;
  }
  const runLen = stats.sides[winner].longestRun;
  if (runLen >= 5) text += ` The longest run was ${runLen} points in a row.`;
  return text;
}
