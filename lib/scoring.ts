import type { Match, MatchStatus, ResultReason, RulePreset, Side } from "@/lib/types";

export const PRESETS: Record<RulePreset, { label: string; detail: string }> = {
  BWF_21: { label: "Best of 3 to 21", detail: "Win by two, capped at 30. Interval at 11." },
  BAI_15: { label: "Best of 3 to 15", detail: "Win by two, capped at 21. Interval at 8." },
  QUICK_21: { label: "One game to 21", detail: "Win by two, capped at 30." },
  SHORT_15: { label: "One game to 15", detail: "Win by two, capped at 21." },
};

export const STATUS_LABEL: Record<MatchStatus, string> = {
  SCHEDULED: "Not started",
  LIVE: "Live",
  GAME_ENDED: "Between games",
  MATCH_WON_PENDING: "Waiting for confirmation",
  FINALIZED: "Final",
  TERMINATED: "Final",
};

export const REASON_LABEL: Record<ResultReason, string> = {
  NORMAL: "",
  WALKOVER: "Walkover",
  RETIREMENT: "Retired",
  DISQUALIFICATION: "Disqualified",
  BYE: "Bye",
};

export const ACTIVE: MatchStatus[] = ["LIVE", "GAME_ENDED", "MATCH_WON_PENDING"];
export const DONE: MatchStatus[] = ["FINALIZED", "TERMINATED"];

export const isActive = (m: Pick<Match, "status">) => ACTIVE.includes(m.status);
export const isDone = (m: Pick<Match, "status">) => DONE.includes(m.status);

export function roundName(round: number, totalRounds: number) {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi-finals";
  if (fromEnd === 2) return "Quarter-finals";
  return `Round of ${2 ** (fromEnd + 1)}`;
}

/** Plain-language call for the current moment of a live game. */
export function callout(m: Match, names: Record<Side, string>): string | null {
  if (m.status === "MATCH_WON_PENDING" && m.winner_side) return `${names[m.winner_side]} wins the match`;
  if (m.status === "GAME_ENDED") {
    const lastWinner = m.serving_side;
    return lastWinner ? `Game ${m.current_game} to ${names[lastWinner]}` : `Game ${m.current_game} over`;
  }
  if (m.status !== "LIVE") return null;
  const { points, cap, best_of, interval_at } = m.rules;
  const a = m.score_a;
  const b = m.score_b;
  if (a === b && a >= points - 1) return `${a} all. Two clear points needed`;
  for (const side of ["A", "B"] as Side[]) {
    const mine = side === "A" ? a : b;
    const theirs = side === "A" ? b : a;
    const won = side === "A" ? m.games_won_a : m.games_won_b;
    const onePointFromGame = (mine + 1 >= points && mine + 1 - theirs >= 2) || mine + 1 >= cap;
    if (onePointFromGame && mine > theirs) {
      const matchPoint = won + 1 >= Math.floor(best_of / 2) + 1;
      return `${matchPoint ? "Match" : "Game"} point, ${names[side]}`;
    }
  }
  // Interval when the leader reaches the mark on this rally (the rally winner now serves).
  const leaderJustReached =
    (a === interval_at && b < interval_at && m.serving_side === "A") ||
    (b === interval_at && a < interval_at && m.serving_side === "B");
  if (leaderJustReached) {
    const deciding = m.current_game === best_of && best_of > 1;
    return deciding ? "Interval. Players change ends" : "Interval";
  }
  return null;
}

/** Service court for the server: even score serves from the right. */
export function serviceCourt(m: Match): "right" | "left" | null {
  if (!m.serving_side || m.status !== "LIVE") return null;
  const s = m.serving_side === "A" ? m.score_a : m.score_b;
  return s % 2 === 0 ? "right" : "left";
}

/** Maps database error codes raised by the schema to plain messages. */
export function explainDbError(message: string | undefined): string {
  const code = (message ?? "").split(/[\s:]/)[0];
  const map: Record<string, string> = {
    VERSION_CONFLICT: "The score changed in another tab. The latest score has been loaded.",
    COURT_BUSY: "That court already has a match in progress. Finish it or move this match to another court.",
    PLAYER_BUSY: "A player in this match is still playing on another court.",
    ENTRIES_MISSING: "Both sides need a player before this match can start.",
    NOTHING_TO_UNDO: "There is nothing to undo yet.",
    BAD_STATE: "That action isn't available at this point in the match.",
    NEXT_MATCH_ALREADY_STARTED: "The next-round match has already started, so this result can't move forward.",
    NOT_FOUND: "That item doesn't exist or you don't have access to it.",
    NOT_AUTHENTICATED: "Your session has ended. Sign in again.",
    SLUG_RESERVED: "That web address is reserved. Choose a different one.",
    SLUG_TAKEN: "That web address is already in use.",
    DRAW_LOCKED: "Matches in this draw have already been played, so it can't be regenerated.",
    NOT_ENOUGH_ENTRIES: "Add at least two entries before making the draw.",
    SINGLES_TAKES_ONE_PLAYER: "Singles entries have one player.",
    DOUBLES_TAKES_TWO_PLAYERS: "Doubles entries need two different players.",
    PLAYER_ALREADY_ENTERED: "That player is already entered in this category.",
    SAME_ENTRY_TWICE: "A match needs two different entries.",
    MATCH_ALREADY_STARTED: "This match has started, so its players can't be changed.",
    CATEGORY_HAS_MATCHES: "Remove this category's matches before changing its format or scoring.",
    LIMIT_TOURNAMENTS: "You've reached the limit of 50 tournaments.",
    LIMIT_PLAYERS: "A tournament can have up to 1,000 players.",
    LIMIT_COURTS: "A tournament can have up to 30 courts.",
    LIMIT_CATEGORIES: "A tournament can have up to 20 categories.",
    LIMIT_ENTRIES: "A category can have up to 128 entries.",
    LIMIT_MATCHES: "A tournament can have up to 2,000 matches.",
  };
  if (map[code]) return map[code];
  if (/duplicate key.*slug/i.test(message ?? "")) return "That web address is already in use.";
  if (/duplicate key.*name/i.test(message ?? "")) return "That name is already used in this tournament.";
  if (/violates foreign key constraint.*entries/i.test(message ?? ""))
    return "This entry is part of a draw. Remove the draw first.";
  return "Something went wrong saving that. Try again.";
}
