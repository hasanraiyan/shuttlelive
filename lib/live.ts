"use client";

import * as React from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Game, Match, MatchWithGames } from "@/lib/types";

/*
 * Live updates without page reloads: realtime row changes are merged into the
 * matches already on screen. RLS applies to every subscriber, so the public
 * only receives rows from published tournaments.
 */

type GameRow = Game & { match_id: string; tournament_id: string };

const byOrder = (a: MatchWithGames, b: MatchWithGames) =>
  a.round - b.round || (a.position ?? 1e9) - (b.position ?? 1e9);

export function mergeMatch(list: MatchWithGames[], p: RealtimePostgresChangesPayload<Match>): MatchWithGames[] {
  if (p.eventType === "DELETE") return list.filter((m) => m.id !== (p.old as Partial<Match>).id);
  const row = p.new as Match;
  const existing = list.find((m) => m.id === row.id);
  if (existing && existing.version > row.version) return list; // older event arriving late
  // Filtered DELETE events aren't delivered by Realtime, so drop games past the
  // current one (left over from an undo across games).
  const games = (existing?.games ?? []).filter((g) => g.game_number <= row.current_game);
  const next: MatchWithGames = { ...row, games };
  return existing ? list.map((m) => (m.id === row.id ? next : m)) : [...list, next].sort(byOrder);
}

export function mergeGame(list: MatchWithGames[], p: RealtimePostgresChangesPayload<GameRow>): MatchWithGames[] {
  const key = (p.eventType === "DELETE" ? p.old : p.new) as Partial<GameRow>;
  return list.map((m) => {
    if (m.id !== key.match_id) return m;
    const others = m.games.filter((g) => g.game_number !== key.game_number);
    if (p.eventType === "DELETE") return { ...m, games: others };
    const g = p.new as GameRow;
    const game: Game = { game_number: g.game_number, score_a: g.score_a, score_b: g.score_b, winner_side: g.winner_side };
    return { ...m, games: [...others, game].sort((a, b) => a.game_number - b.game_number) };
  });
}

/**
 * Subscribes to a tournament's matches and games. After every (re)connect it
 * fetches the current rows once, so nothing missed while offline is lost.
 */
export function useLiveMatches(
  tournamentId: string,
  setMatches: React.Dispatch<React.SetStateAction<MatchWithGames[]>>,
  enabled = true
) {
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();

    const sync = async () => {
      const { data } = await supabase
        .from("matches")
        .select("*, games:match_games(game_number, score_a, score_b, winner_side)")
        .eq("tournament_id", tournamentId);
      if (!data) return;
      setMatches(
        (data as MatchWithGames[])
          .map((m) => ({ ...m, games: [...m.games].sort((a, b) => a.game_number - b.game_number) }))
          .sort(byOrder)
      );
    };

    const channel = supabase
      .channel(`live-${tournamentId}`)
      .on<Match>(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${tournamentId}` },
        (p) => setMatches((list) => mergeMatch(list, p))
      )
      .on<GameRow>(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_games", filter: `tournament_id=eq.${tournamentId}` },
        (p) => setMatches((list) => mergeGame(list, p))
      )
      .subscribe((status) => {
        const ok = status === "SUBSCRIBED";
        setConnected(ok);
        if (ok) void sync();
      });

    // Fallback while the socket is down: one light query every 10 s, only when visible.
    const poll = setInterval(() => {
      if (channel.state !== "joined" && document.visibilityState === "visible") void sync();
    }, 10_000);

    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [tournamentId, setMatches, enabled]);

  return connected;
}

/**
 * Tracks how many people are currently viewing a tournament (including its
 * match pages) via Supabase Realtime Presence. No database writes required.
 */
export function useLiveViewers(
  tournamentId: string,
  opts: { enabled?: boolean; track?: boolean } = {}
) {
  const { enabled = true, track = true } = opts;
  const [count, setCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const key =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const channel = supabase.channel(`viewers-${tournamentId}`, {
      config: { presence: { key } },
    });

    const updateCount = () => {
      const state = channel.presenceState();
      setCount(Object.keys(state).length);
    };

    channel
      .on("presence", { event: "sync" }, updateCount)
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && track) {
          void channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tournamentId, enabled, track]);

  return count;
}
