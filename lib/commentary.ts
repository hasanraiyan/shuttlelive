import type { CommentaryEvent, Rules, Side } from "@/lib/types";

export type Line = {
  key: string;
  at: string;
  game: number;
  text: string;
  /** Score after this moment, side A first. */
  score: string | null;
  /**
   * rally: plain point. swing: lead changes or levels (a key moment).
   * moment: streaks, intervals, deuce, game/match points. result: games and matches.
   */
  tone: "rally" | "swing" | "moment" | "result";
};

export const isKeyLine = (l: Line) => l.tone !== "rally";

const other = (s: Side): Side => (s === "A" ? "B" : "A");

function minutes(fromIso: string, toIso: string) {
  const m = Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60000);
  return m >= 1 ? ` in ${m} minute${m === 1 ? "" : "s"}` : "";
}

/**
 * Fact-based commentary built only from the match log. Every line follows from
 * the score: leads taken and lost, levels, runs, intervals, deuce, game and
 * match points, saves, comebacks and results. Returns newest first.
 */
export function buildCommentary(events: CommentaryEvent[], names: Record<Side, string>, rules: Rules): Line[] {
  const { points, cap, best_of, interval_at } = rules;
  const toWinMatch = Math.floor(best_of / 2) + 1;
  const lines: Line[] = [];
  let lastWinner: Side | null = null;
  let streak = 0;
  let gameStartedAt: string | null = null;
  const gameScores: [number, number][] = [];
  // Per game: who has led at any point, and each side's worst deficit.
  let hasLed: Record<Side, boolean> = { A: false, B: false };
  let worst: Record<Side, { by: number; score: string }> = { A: { by: 0, score: "" }, B: { by: 0, score: "" } };

  const atGamePoint = (mine: number, theirs: number) =>
    (mine + 1 >= points && mine + 1 - theirs >= 2) || mine + 1 >= cap;

  const newGame = () => {
    streak = 0;
    hasLed = { A: false, B: false };
    worst = { A: { by: 0, score: "" }, B: { by: 0, score: "" } };
  };

  for (const e of events) {
    const push = (text: string, tone: Line["tone"], score: string | null, game: number, suffix = "") =>
      lines.push({ key: `${e.seq}${suffix}`, at: e.at, game, text, score, tone });

    if (e.command === "START" && e.side) {
      gameStartedAt = e.at;
      lastWinner = e.side;
      newGame();
      push(`Match underway. ${names[e.side]} serves first.`, "moment", "0–0", 1);
      continue;
    }

    if (e.command === "NEXT_GAME") {
      gameStartedAt = e.at;
      newGame();
      const server = lastWinner ? names[lastWinner] : null;
      push(`Game ${e.game + 1} begins.${server ? ` ${server} serves.` : ""}`, "moment", "0–0", e.game + 1);
      continue;
    }

    if (e.command === "CONFIRM") {
      push("Result confirmed.", "moment", null, e.game);
      continue;
    }

    if (e.command === "TERMINATE" && e.side) {
      const loser = names[other(e.side)];
      const why =
        e.reason === "WALKOVER"
          ? `${loser} conceded a walkover`
          : e.reason === "RETIREMENT"
            ? `${loser} retired`
            : `${loser} was disqualified`;
      push(`${names[e.side]} wins. ${why}.`, "result", null, e.game);
      continue;
    }

    if (e.command !== "POINT" || !e.side) continue;

    const X = e.side;
    const O = other(X);
    const g = e.game;
    const a = e.a + (X === "A" ? 1 : 0);
    const b = e.b + (X === "B" ? 1 : 0);
    const mine = X === "A" ? a : b;
    const theirs = X === "A" ? b : a;
    const before = (X === "A" ? e.a : e.b) - (X === "A" ? e.b : e.a); // X's lead before the rally
    const lead = mine - theirs;
    const score = `${a}–${b}`;
    const own = `${mine}–${theirs}`; // from X's point of view
    const wonBefore = { A: e.ga, B: e.gb };

    streak = lastWinner === X ? streak + 1 : 1;
    lastWinner = X;

    const gameWon = (mine >= points && mine - theirs >= 2) || mine >= cap;

    // Track deficits for comebacks (from the trailing side's view).
    if (-lead > worst[X].by) worst[X] = { by: -lead, score: `${mine}–${theirs}` };
    if (lead > worst[O].by) worst[O] = { by: lead, score: `${theirs}–${mine}` };

    // Was the opponent one rally from the game (or match) before this point?
    const oppMine = X === "A" ? e.b : e.a;
    const oppTheirs = X === "A" ? e.a : e.b;
    const oppHadPoint = atGamePoint(oppMine, oppTheirs) && oppMine > oppTheirs;
    const oppMatchPoint = oppHadPoint && wonBefore[O] + 1 >= toWinMatch;

    if (gameWon) {
      gameScores.push([a, b]);
      const matchWon = wonBefore[X] + 1 >= toWinMatch;
      if (matchWon) {
        const all = gameScores.map(([ga, gb]) => (X === "A" ? `${ga}–${gb}` : `${gb}–${ga}`)).join(", ");
        push(`${names[X]} wins the match, ${all}.`, "result", score, g);
      } else {
        const dur = gameStartedAt ? minutes(gameStartedAt, e.at) : "";
        push(`Game ${g} to ${names[X]}, ${own}${dur}.`, "result", score, g);
      }
      continue;
    }

    // Single authoritative commentary entry per rally (prevents duplicate rows with identical scores)
    let text: string;
    let tone: Line["tone"] = "rally";

    if (oppHadPoint) {
      text = `${names[X]} saves a ${oppMatchPoint ? "match" : "game"} point to make it ${own}.`;
      tone = "moment";
    } else if (a === b && a >= points - 1) {
      text = `${names[X]} levels at ${mine} all. Deuce — two clear points needed.`;
      tone = "moment";
    } else if (lead === 1 && before === 0 && worst[X].by >= 4) {
      text = `Comeback! ${names[X]} was ${worst[X].score} down and now leads ${own}.`;
      tone = "moment";
    } else if (atGamePoint(mine, theirs) && mine > theirs) {
      const matchPoint = wonBefore[X] + 1 >= toWinMatch;
      const streakSuffix = streak >= 4 ? ` (${streak} points in a row)` : "";
      text = `${matchPoint ? "Match" : "Game"} point for ${names[X]} at ${own}${streakSuffix}.`;
      tone = "moment";
    } else if (mine === interval_at && theirs < interval_at) {
      const deciding = best_of > 1 && g === best_of;
      text = `Interval reached. ${names[X]} leads ${own}${deciding ? " — players change ends" : ""}.`;
      tone = "moment";
    } else if (streak >= 4) {
      if (lead > 0) {
        text = `${names[X]} extends the lead to ${own} (${streak} points in a row).`;
      } else if (lead === 0) {
        text = `${names[X]} levels at ${mine} all (${streak} points in a row).`;
      } else {
        text = `${names[X]} pulls one back to ${own} (${streak} points in a row).`;
      }
      tone = "moment";
    } else if (a + b === 1) {
      text = `${names[X]} opens the scoring.`;
      tone = "rally";
    } else if (lead === 0) {
      text = `${names[X]} levels at ${mine} all.`;
      tone = "swing";
    } else if (lead === 1 && before === 0) {
      text = hasLed[X] ? `${names[X]} is back in front, ${own}.` : `${names[X]} takes the lead, ${own}.`;
      tone = "swing";
    } else if (lead > 1) {
      text = `${names[X]} extends the lead to ${own}.`;
      tone = "rally";
    } else if (lead < 0) {
      text = `${names[X]} pulls one back, ${own}.`;
      tone = "rally";
    } else {
      text = `${names[X]} wins the rally, ${own}.`;
      tone = "rally";
    }

    if (lead > 0) hasLed[X] = true;
    push(text, tone, score, g);
  }

  return lines.reverse();
}
