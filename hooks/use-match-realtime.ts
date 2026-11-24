"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { Match } from "@/lib/types/database";

export function useMatchRealtime(initialMatch: Match | null) {
  const [match, setMatch] = React.useState<Match | null>(initialMatch);
  const [isConnected, setIsConnected] = React.useState(false);
  const [commentary, setCommentary] = React.useState<Array<{ timestamp: string; score: string; text: string }>>([]);

  const supabase = createClient();
  const matchId = match?.id;

  const fetchLatestState = React.useCallback(async () => {
    if (!matchId) return;
    try {
      const res = await fetch(`/api/public/matches/${matchId}`);
      if (res.ok) {
        const data = await res.json();
        setMatch(data.match);
        setCommentary(data.commentary || []);
      }
    } catch {
      // Polling fallback error handled gracefully
    }
  }, [matchId]);

  React.useEffect(() => {
    if (!matchId) return;

    // 1. Setup Supabase Realtime Channel
    const channel = supabase
      .channel(`match:${matchId}`)
      .on("broadcast", { event: "score_update" }, (payload) => {
        setIsConnected(true);
        if (payload.payload) {
          fetchLatestState();
        }
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
        () => {
          fetchLatestState();
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    // 2. HTTP Polling Fallback (every 3 seconds as a safety net)
    const interval = setInterval(() => {
      fetchLatestState();
    }, 3000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [matchId, supabase, fetchLatestState]);

  return { match, isConnected, commentary, refresh: fetchLatestState };
}
