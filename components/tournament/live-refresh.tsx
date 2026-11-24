"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-renders the public page when a match in this tournament changes.
 * Realtime first; if the socket isn't connected, polls every 5 seconds.
 */
export function LiveRefresh({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [connected, setConnected] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };
    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${tournamentId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_games", filter: `tournament_id=eq.${tournamentId}` }, refresh)
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [tournamentId, router]);

  React.useEffect(() => {
    if (connected) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [connected, router]);

  return (
    <p className="flex items-center gap-2 text-xs text-ink-soft" aria-live="polite">
      <span className={`size-2 rounded-full ${connected ? "bg-live" : "bg-warn"}`} aria-hidden="true" />
      {connected ? "Scores update live" : "Reconnecting, refreshing every few seconds"}
    </p>
  );
}
