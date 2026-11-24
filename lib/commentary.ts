import type { CommentaryEvent, Rules, Side } from "@/lib/types";

export type Line = {
  key: string;
  at: string;
  text: string;
  /** Score after this moment, side A first. */
  score: string | null;
  tone: "rally" | "moment" | "result";
};

const other = (s: Side): Side => (s === "A" ? "B" : "A");

function minutes(fromIso: string, toIso: string) {
  const m = Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60000);
  return m >= 1 ? ` in ${m} minute${m === 1 ? "" : "s"}` : "";
}

/**
 * Fact-based commentary built only from the match log: who won each rally,
 * streaks, intervals, deuce, game and match points, saves, and results.
 * Returns newest first.
 */
export function buildCommentary(events: CommentaryEvent[], names: Record<Side, string>, rules: Rules): Line[] {
  const { points, cap, best_of, interval_at } = rules;
  const toWinMatch = Math.floor(best_of / 2) + 1;
  const lines: Line[] = [];
  let lastWinner: Side | null = null;
  let streak = 0;
  let gameStartedAt: string | null = null;
  const gameScores: [number, number][] = [];

  const atGamePoint = (mine: number, theirs: number) =>
    (mine + 1 >= points && mine + 1 - theirs >= 2) || mine + 1 >= cap;

  for (const e of events) {
    const push = (text: string, tone: Line["tone"], score: string | null, suffix = "") =>
      lines.push({ key: `${e.seq}${suffix}`, at: e.at, text, score, tone });

    if (e.command === "START" && e.side) {
      gameStartedAt = e.at;
      lastWinner = e.side;
      streak = 0;
      push(`Match underway. ${names[e.side]} serves first.`, "moment", "0–0");
      continue;
    }

    if (e.command === "NEXT_GAME") {
      gameStartedAt = e.at;
      streak = 0;
      const server = lastWinner ? names[lastWinner] : null;
      push(`Game ${e.game + 1} begins.${server ? ` ${server} serves.` : ""}`, "moment", "0–0");
      continue;
    }

    if (e.command === "CONFIRM") {
      push("Result confirmed.", "moment", null);
      continue;
    }

    if (e.command === "TERMINATE" && e.side) {
      const loser = names[other(e.side)];
      const why =
        e.reason === "WALKOVER"
          ? `${loser} didn't play (walkover)`
          : e.reason === "RETIREMENT"
            ? `${loser} retired`
            : `${loser} was disqualified`;
      push(`${names[e.side]} wins. ${why}.`, "result", null);
      continue;
    }

    if (e.command !== "POINT" || !e.side) continue;

    const X = e.side;
    const a = e.a + (X === "A" ? 1 : 0);
    const b = e.b + (X === "B" ? 1 : 0);
    const mine = X === "A" ? a : b;
    const theirs = X === "A" ? b : a;
    const score = `${a}–${b}`;
    const wonBefore = { A: e.ga, B: e.gb };

    streak = lastWinner === X ? streak + 1 : 1;
    lastWinner = X;

    const gameWon = (mine >= points && mine - theirs >= 2) || mine >= cap;

    // Was the opponent one rally from the game (or match) before this point?
    const oppMine = X === "A" ? e.b : e.a;
    const oppTheirs = X === "A" ? e.a : e.b;
    const oppHadPoint = atGamePoint(oppMine, oppTheirs) && oppMine > oppTheirs;
    const oppMatchPoint = oppHadPoint && wonBefore[other(X)] + 1 >= toWinMatch;

    if (gameWon) {
      gameScores.push([a, b]);
      const matchWon = wonBefore[X] + 1 >= toWinMatch;
      if (matchWon) {
        const all = gameScores.map(([ga, gb]) => (X === "A" ? `${ga}–${gb}` : `${gb}–${ga}`)).join(", ");
        push(`${names[X]} wins the match, ${all}.`, "result", score);
      } else {
        const dur = gameStartedAt ? minutes(gameStartedAt, e.at) : "";
        push(`Game ${e.game} to ${names[X]}, ${mine}–${theirs}${dur}.`, "result", score);
      }
      continue;
    }

    push(`${names[X]} wins the rally.`, "rally", score);

    if (oppHadPoint) {
      push(`${names[X]} saves a ${oppMatchPoint ? "match" : "game"} point.`, "moment", score, "s");
    }
    if (a === b && a >= points - 1) {
      push(`${a} all. Two clear points needed.`, "moment", score, "d");
    } else if (atGamePoint(mine, theirs) && mine > theirs) {
      const matchPoint = wonBefore[X] + 1 >= toWinMatch;
      push(`${matchPoint ? "Match" : "Game"} point, ${names[X]}.`, "moment", score, "g");
    }

    if (mine === interval_at && theirs < interval_at) {
      const deciding = best_of > 1 && e.game === best_of;
      push(`Interval. ${names[X]} leads ${mine}–${theirs}${deciding ? ". Players change ends" : ""}.`, "moment", score, "i");
    } else if (streak >= 4) {
      push(`${names[X]} has won ${streak} points in a row.`, "moment", score, "r");
    }
  }

  return lines.reverse();
}
