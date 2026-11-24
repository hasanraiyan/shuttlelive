"use client";

import * as React from "react";
import type { Bundle } from "@/lib/data";
import { useLiveMatches } from "@/lib/live";
import type { MatchWithGames } from "@/lib/types";

type Ctx = {
  bundle: Bundle;
  /** Organizations the user belongs to (for moving a tournament between them). */
  myOrgs: { id: string; name: string }[];
  /** Apply a confirmed match state (from the scoring screen) without reloading. */
  patchMatch: (m: MatchWithGames) => void;
  live: boolean;
};

const TournamentContext = React.createContext<Ctx | null>(null);

/**
 * Holds one tournament's data for every dashboard tab. The layout loads it once;
 * tabs read it here, so moving between tabs makes no server calls. Realtime and
 * the scoring screen patch matches in place. After a server action the layout
 * re-renders with fresh data, which replaces this state.
 */
export function TournamentProvider({
  initial,
  myOrgs = [],
  children,
}: {
  initial: Bundle;
  myOrgs?: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  const [source, setSource] = React.useState(initial);
  const [matches, setMatches] = React.useState(initial.matches);

  // New data from the server (after a mutation) replaces local state.
  if (initial !== source) {
    setSource(initial);
    setMatches(initial.matches);
  }

  const live = useLiveMatches(initial.tournament.id, setMatches);

  const patchMatch = React.useCallback((m: MatchWithGames) => {
    setMatches((list) => list.map((x) => (x.id === m.id && m.version >= x.version ? m : x)));
  }, []);

  const value = React.useMemo<Ctx>(
    () => ({ bundle: { ...source, matches }, myOrgs, patchMatch, live }),
    [source, matches, myOrgs, patchMatch, live]
  );
  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
}

export function useTournament() {
  const ctx = React.useContext(TournamentContext);
  if (!ctx) throw new Error("useTournament must be used inside TournamentProvider");
  return ctx;
}
