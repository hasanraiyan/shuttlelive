import type { Entry, MatchWithGames } from "@/lib/types";

const WINDOW_MS = 30 * 60 * 1000;

export type Clash = { kind: "court" | "player"; text: string };

/**
 * Warnings for scheduled matches: the same court, or the same player, booked
 * within 30 minutes of another unplayed match (SRS FR-SCR-03, TC-18).
 */
export function findClashes(
  matches: MatchWithGames[],
  entries: Entry[],
  playerName: Record<string, string>,
  courtName: Record<string, string>
): Record<string, Clash[]> {
  const playersOf = (m: MatchWithGames) =>
    entries
      .filter((e) => e.id === m.entry_a_id || e.id === m.entry_b_id)
      .flatMap((e) => [e.player1_id, e.player2_id])
      .filter(Boolean) as string[];

  const timed = matches.filter((m) => m.status === "SCHEDULED" && m.scheduled_at);
  const out: Record<string, Clash[]> = {};
  for (const m of timed) {
    const t = Date.parse(m.scheduled_at!);
    const mine = new Set(playersOf(m));
    for (const o of timed) {
      if (o.id === m.id || Math.abs(Date.parse(o.scheduled_at!) - t) >= WINDOW_MS) continue;
      if (m.court_id && o.court_id === m.court_id) {
        (out[m.id] ??= []).push({ kind: "court", text: `${courtName[m.court_id]} has another match within 30 minutes` });
      }
      for (const p of playersOf(o)) {
        if (mine.has(p)) {
          (out[m.id] ??= []).push({ kind: "player", text: `${playerName[p]} is due on another match within 30 minutes` });
        }
      }
    }
  }
  for (const id of Object.keys(out)) {
    out[id] = out[id].filter((c, i, arr) => arr.findIndex((x) => x.text === c.text) === i);
  }
  return out;
}

/** Scheduled matches first, by time then court, then the rest in draw order. */
export function byOrderOfPlay(a: MatchWithGames, b: MatchWithGames) {
  if (a.scheduled_at && b.scheduled_at) return a.scheduled_at.localeCompare(b.scheduled_at);
  if (a.scheduled_at) return -1;
  if (b.scheduled_at) return 1;
  return a.round - b.round || (a.position ?? 0) - (b.position ?? 0);
}
