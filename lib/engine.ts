import type { MatchWithGames, Side } from "@/lib/types";

/*
 * Client-side mirror of apply_match_command() for the commands that can be
 * queued offline (POINT, NEXT_GAME). The database stays the authority: every
 * queued command is replayed there in order and its result replaces this guess.
 * Keep this in step with supabase/migrations/*_p0_secure_core.sql.
 */

export function applyPoint(m: MatchWithGames, side: Side): MatchWithGames {
  if (m.status !== "LIVE") return m;
  const { points, cap, best_of } = m.rules;
  const a = m.score_a + (side === "A" ? 1 : 0);
  const b = m.score_b + (side === "B" ? 1 : 0);
  const mine = side === "A" ? a : b;
  const theirs = side === "A" ? b : a;
  const gameOver = (mine >= points && mine - theirs >= 2) || mine >= cap;

  let games = m.games.some((g) => g.game_number === m.current_game)
    ? m.games
    : [...m.games, { game_number: m.current_game, score_a: 0, score_b: 0, winner_side: null }];
  games = games.map((g) =>
    g.game_number === m.current_game ? { ...g, score_a: a, score_b: b, winner_side: gameOver ? side : null } : g
  );

  const next: MatchWithGames = { ...m, score_a: a, score_b: b, serving_side: side, games, version: m.version + 1 };
  if (!gameOver) return next;

  const wa = m.games_won_a + (side === "A" ? 1 : 0);
  const wb = m.games_won_b + (side === "B" ? 1 : 0);
  const matchOver = Math.max(wa, wb) >= Math.floor(best_of / 2) + 1;
  return {
    ...next,
    games_won_a: wa,
    games_won_b: wb,
    status: matchOver ? "MATCH_WON_PENDING" : "GAME_ENDED",
    winner_side: matchOver ? side : null,
  };
}

export function applyNextGame(m: MatchWithGames): MatchWithGames {
  if (m.status !== "GAME_ENDED") return m;
  const n = m.current_game + 1;
  return {
    ...m,
    status: "LIVE",
    current_game: n,
    score_a: 0,
    score_b: 0,
    games: [...m.games, { game_number: n, score_a: 0, score_b: 0, winner_side: null }],
    version: m.version + 1,
  };
}

/** Seconds of rest the laws allow at this moment, if any. */
export function restSeconds(m: MatchWithGames): number | null {
  if (m.status === "GAME_ENDED") return 120;
  if (m.status !== "LIVE") return null;
  const { interval_at } = m.rules;
  const leaderJustReached =
    (m.score_a === interval_at && m.score_b < interval_at && m.serving_side === "A") ||
    (m.score_b === interval_at && m.score_a < interval_at && m.serving_side === "B");
  return leaderJustReached ? 60 : null;
}
