"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppIcon } from "@/components/layout/app-icon";

interface MatchState {
  id: string;
  categoryName: string;
  courtName: string;
  sideAName: string;
  sideBName: string;
  currentGame: number;
  scoreA: number;
  scoreB: number;
  gamesWonA: number;
  gamesWonB: number;
  servingSide: "A" | "B";
  status: "SCHEDULED" | "LIVE" | "INTERVAL" | "GAME_ENDED" | "MATCH_WON_PENDING" | "FINALIZED";
  version: number;
}

function ScorerConsole() {
  const searchParams = useSearchParams();
  const matchId = searchParams.get("matchId") || "demo-match-01";
  const pin = searchParams.get("pin");

  const [match, setMatch] = React.useState<MatchState>({
    id: matchId,
    categoryName: "Men's Singles (Quarterfinals)",
    courtName: "Court 1",
    sideAName: "Aman Kumar",
    sideBName: "Rahul Sharma",
    currentGame: 1,
    scoreA: 0,
    scoreB: 0,
    gamesWonA: 0,
    gamesWonB: 0,
    servingSide: "A",
    status: "LIVE",
    version: 1,
  });

  const [loading, setLoading] = React.useState(false);
  const [intervalSeconds, setIntervalSeconds] = React.useState(60);
  const [showInterval, setShowInterval] = React.useState(false);

  // Send scoring event to backend API
  const sendCommand = async (type: string, side?: "A" | "B") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/matches/${match.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          side,
          expectedVersion: match.version,
          clientEventId: crypto.randomUUID(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMatch((prev) => ({
          ...prev,
          scoreA: data.score_a ?? (side === "A" ? prev.scoreA + 1 : prev.scoreA),
          scoreB: data.score_b ?? (side === "B" ? prev.scoreB + 1 : prev.scoreB),
          gamesWonA: data.games_won_a ?? prev.gamesWonA,
          gamesWonB: data.games_won_b ?? prev.gamesWonB,
          status: data.status || prev.status,
          version: data.version || prev.version + 1,
          servingSide: side || prev.servingSide,
        }));
      } else {
        // Fallback for local demo simulation
        if (type === "POINT_WON" && side) {
          const nextA = side === "A" ? match.scoreA + 1 : match.scoreA;
          const nextB = side === "B" ? match.scoreB + 1 : match.scoreB;
          const isInterval = (nextA === 11 || nextB === 11) && nextA < 21 && nextB < 21;
          const isGameWon = (nextA >= 21 && nextA - nextB >= 2) || nextA === 30 || (nextB >= 21 && nextB - nextA >= 2) || nextB === 30;

          setMatch((prev) => ({
            ...prev,
            scoreA: nextA,
            scoreB: nextB,
            servingSide: side,
            version: prev.version + 1,
            status: isGameWon ? (prev.gamesWonA === 1 || prev.gamesWonB === 1 ? "MATCH_WON_PENDING" : "GAME_ENDED") : isInterval ? "INTERVAL" : "LIVE",
          }));

          if (isInterval) {
            setShowInterval(true);
            setIntervalSeconds(60);
          }
        } else if (type === "UNDO") {
          setMatch((prev) => ({
            ...prev,
            scoreA: Math.max(0, prev.scoreA - 1),
            status: "LIVE",
            version: prev.version + 1,
          }));
        } else if (type === "FINALIZE_RESULT") {
          setMatch((prev) => ({ ...prev, status: "FINALIZED" }));
        }
      }
    } catch {
      // Offline / Local fallback simulation
      if (type === "POINT_WON" && side) {
        setMatch((prev) => ({
          ...prev,
          scoreA: side === "A" ? prev.scoreA + 1 : prev.scoreA,
          scoreB: side === "B" ? prev.scoreB + 1 : prev.scoreB,
          servingSide: side,
          version: prev.version + 1,
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  const isDeuce = match.scoreA >= 20 && match.scoreB >= 20;
  const serviceCourtA = match.scoreA % 2 === 0 ? "Right Court" : "Left Court";
  const serviceCourtB = match.scoreB % 2 === 0 ? "Right Court" : "Left Court";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white select-none">
      {/* Top Status Bar */}
      <header className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
        <Link href="/" className="flex items-center gap-2 text-xs font-bold text-zinc-300">
          <AppIcon className="size-5" />
          <span>ShuttleLive Umpire Console</span>
        </Link>
        <div className="flex items-center gap-2">
          {pin && (
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-400">
              PIN: {pin}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            {match.courtName}
          </span>
        </div>
      </header>

      {/* Match Context Bar */}
      <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-2 text-center">
        <span className="text-xs font-medium text-zinc-400">
          {match.categoryName} · Game {match.currentGame} (Best of 3)
        </span>
      </div>

      {/* Main Score & Players Area */}
      <main className="flex flex-1 flex-col justify-between p-4 sm:p-6">
        {/* Score Display Cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Side A Card */}
          <div
            className={`flex flex-col items-center justify-between rounded-2xl border p-4 sm:p-6 transition-colors ${
              match.servingSide === "A"
                ? "border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-500/10"
                : "border-zinc-800 bg-zinc-900/40"
            }`}
          >
            <div className="flex flex-col items-center">
              <span className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-1.5">
                {match.sideAName}
                {match.servingSide === "A" && <span title="Serving">🏸</span>}
              </span>
              <span className="text-[11px] text-zinc-400">Games Won: {match.gamesWonA}</span>
            </div>

            <div className="my-6 font-mono text-6xl sm:text-7xl font-black tracking-tight text-white">
              {match.scoreA}
            </div>

            <span className="text-xs font-semibold text-emerald-400">
              {match.servingSide === "A" ? `Serving (${serviceCourtA})` : "Receiving"}
            </span>
          </div>

          {/* Side B Card */}
          <div
            className={`flex flex-col items-center justify-between rounded-2xl border p-4 sm:p-6 transition-colors ${
              match.servingSide === "B"
                ? "border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-500/10"
                : "border-zinc-800 bg-zinc-900/40"
            }`}
          >
            <div className="flex flex-col items-center">
              <span className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-1.5">
                {match.sideBName}
                {match.servingSide === "B" && <span title="Serving">🏸</span>}
              </span>
              <span className="text-[11px] text-zinc-400">Games Won: {match.gamesWonB}</span>
            </div>

            <div className="my-6 font-mono text-6xl sm:text-7xl font-black tracking-tight text-white">
              {match.scoreB}
            </div>

            <span className="text-xs font-semibold text-emerald-400">
              {match.servingSide === "B" ? `Serving (${serviceCourtB})` : "Receiving"}
            </span>
          </div>
        </div>

        {/* Deuce / Status Banner */}
        {isDeuce && (
          <div className="my-3 flex items-center justify-center gap-2 rounded-xl bg-amber-500/10 py-2 text-xs font-bold text-amber-400">
            <span>⚡ DEUCE</span>
            <span>·</span>
            <span>Must win by 2 points (Cap at 30)</span>
          </div>
        )}

        {/* Big Single-Tap Touch Targets (48px+ touch ergonomic) */}
        <div className="my-4 grid grid-cols-2 gap-4">
          <button
            type="button"
            disabled={loading || match.status === "MATCH_WON_PENDING" || match.status === "FINALIZED"}
            onClick={() => sendCommand("POINT_WON", "A")}
            className="flex h-24 sm:h-28 flex-col items-center justify-center rounded-2xl bg-emerald-600 font-bold text-white shadow-xl shadow-emerald-950 transition-all active:scale-95 disabled:opacity-40"
          >
            <span className="text-2xl sm:text-3xl">+1</span>
            <span className="text-xs sm:text-sm font-semibold truncate max-w-[140px]">
              {match.sideAName}
            </span>
          </button>

          <button
            type="button"
            disabled={loading || match.status === "MATCH_WON_PENDING" || match.status === "FINALIZED"}
            onClick={() => sendCommand("POINT_WON", "B")}
            className="flex h-24 sm:h-28 flex-col items-center justify-center rounded-2xl bg-emerald-600 font-bold text-white shadow-xl shadow-emerald-950 transition-all active:scale-95 disabled:opacity-40"
          >
            <span className="text-2xl sm:text-3xl">+1</span>
            <span className="text-xs sm:text-sm font-semibold truncate max-w-[140px]">
              {match.sideBName}
            </span>
          </button>
        </div>

        {/* Umpire Secondary Control Toolbar */}
        <div className="grid grid-cols-4 gap-2 pt-2">
          <button
            type="button"
            onClick={() => sendCommand("UNDO")}
            disabled={loading}
            className="flex h-12 flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-300 hover:bg-zinc-850 active:scale-95 disabled:opacity-40"
          >
            <span>↶</span>
            <span>Undo</span>
          </button>

          <button
            type="button"
            onClick={() => sendCommand("POINT_WON", match.servingSide === "A" ? "B" : "A")}
            disabled={loading}
            className="flex h-12 flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-medium text-rose-400 hover:bg-zinc-850 active:scale-95 disabled:opacity-40"
          >
            <span>⚠️</span>
            <span>Fault</span>
          </button>

          <button
            type="button"
            onClick={() => alert("Let called: Rally replayed, score unchanged.")}
            className="flex h-12 flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-medium text-amber-400 hover:bg-zinc-850 active:scale-95"
          >
            <span>🔄</span>
            <span>Let</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowInterval(true);
              setIntervalSeconds(60);
            }}
            className="flex h-12 flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-medium text-indigo-400 hover:bg-zinc-850 active:scale-95"
          >
            <span>⏱️</span>
            <span>Interval</span>
          </button>
        </div>
      </main>

      {/* Provisional Match Won Modal (Pending Confirmation) */}
      {match.status === "MATCH_WON_PENDING" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center shadow-2xl">
            <span className="text-3xl">🏆</span>
            <h3 className="mt-2 text-lg font-bold text-white">Match Won!</h3>
            <p className="mt-1 text-xs text-zinc-400">
              {match.scoreA > match.scoreB ? match.sideAName : match.sideBName} has won the match.
              Please confirm the official result to advance the bracket.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => sendCommand("FINALIZE_RESULT")}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-lg shadow-emerald-950 hover:bg-emerald-700"
              >
                Confirm Official Result ✓
              </button>
              <button
                type="button"
                onClick={() => sendCommand("UNDO")}
                className="flex h-10 w-full items-center justify-center rounded-xl border border-zinc-700 text-xs font-medium text-zinc-400 hover:text-white"
              >
                ↶ Undo Accidental Final Point
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 60s Interval Timer Modal */}
      {showInterval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center shadow-2xl">
            <span className="text-xs font-bold tracking-wider text-amber-400 uppercase">
              11-Point Mid-Game Interval
            </span>
            <div className="my-4 font-mono text-5xl font-black text-white">{intervalSeconds}s</div>
            <p className="text-xs text-zinc-400">60-second break for players and coaching advice.</p>
            <button
              type="button"
              onClick={() => setShowInterval(false)}
              className="mt-6 flex h-10 w-full items-center justify-center rounded-xl bg-zinc-800 text-xs font-semibold text-white hover:bg-zinc-700"
            >
              Resume Play Early
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScorerPage() {
  return (
    <React.Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-zinc-950 text-xs text-zinc-500">Loading Umpire Console...</div>}>
      <ScorerConsole />
    </React.Suspense>
  );
}
