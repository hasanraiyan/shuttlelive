import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTournamentBySlug } from "@/lib/actions/tournaments";
import { AppIcon } from "@/components/layout/app-icon";

async function TournamentContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getTournamentBySlug(slug);

  if (!result) {
    notFound();
  }

  if ("redirect" in result) {
    redirect(`/t/${result.redirect}`);
  }

  const { tournament, branding, courts, categories, liveMatches } = result;

  const primaryColor = branding?.primary_color || "#0f172a";
  const accentColor = branding?.accent_color || "#10b981";

  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-950 antialiased dark:bg-zinc-950 dark:text-zinc-50">
      {/* Top Navigation Bar */}
      <nav className="border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100">
            <AppIcon className="size-5" />
            <span>ShuttleLive</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              ● {tournament.status === "IN_PROGRESS" || liveMatches.length > 0 ? "LIVE NOW" : tournament.status}
            </span>
          </div>
        </div>
      </nav>

      {/* Branded Header Hero */}
      <header
        className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800"
        style={{
          background: branding?.banner_url
            ? `url(${branding.banner_url}) center/cover no-repeat`
            : `linear-gradient(135deg, ${primaryColor} 0%, #000000 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
        
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:px-6 sm:py-16">
          {/* Tournament Logo */}
          {branding?.logo_url ? (
            <img
              src={branding.logo_url}
              alt={tournament.name}
              className="size-20 sm:size-24 rounded-2xl border-2 border-white/20 object-cover shadow-2xl"
            />
          ) : (
            <div
              className="flex size-20 sm:size-24 shrink-0 items-center justify-center rounded-2xl border-2 border-white/20 text-3xl font-black text-white shadow-2xl"
              style={{ backgroundColor: accentColor }}
            >
              🏸
            </div>
          )}

          {/* Tournament Title & Info */}
          <div className="flex flex-col text-white">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-emerald-400">
              <span>{tournament.organizer_display_name}</span>
              {tournament.edition_season && (
                <>
                  <span>·</span>
                  <span>{tournament.edition_season}</span>
                </>
              )}
            </div>

            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-4xl">
              {tournament.name}
            </h1>

            {tournament.subtitle && (
              <p className="mt-1 text-sm text-zinc-300">{tournament.subtitle}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-300">
              <span>📍 {tournament.venue_name}</span>
              <span>📅 {new Date(tournament.start_date).toLocaleDateString()} – {new Date(tournament.end_date).toLocaleDateString()}</span>
              {tournament.venue_google_maps_url && (
                <a
                  href={tournament.venue_google_maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
                >
                  Get Directions ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        
        {/* Active Courts Live Section */}
        <section className="mb-10">
          <div className="flex items-center justify-between pb-4">
            <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Court Scoreboards
            </h2>
            <span className="text-xs text-zinc-500">{courts.length} Courts Active</span>
          </div>

          {liveMatches.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {liveMatches.map((m: any) => (
                <Link
                  key={m.id}
                  href={`/scorer?matchId=${m.id}`}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-emerald-500 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      ● {m.court?.name || "Court"}
                    </span>
                    <span className="text-xs text-zinc-400">Game {m.current_game}</span>
                  </div>

                  <div className="my-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-zinc-100">{m.entry_a?.display_name || "Side A"}</p>
                      <p className="font-bold text-zinc-900 dark:text-zinc-100">{m.entry_b?.display_name || "Side B"}</p>
                    </div>
                    <div className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {m.games_won_a} — {m.games_won_b}
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold text-zinc-500">Tap to follow live point progression →</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-xs text-zinc-500 dark:border-zinc-800">
              No matches currently in progress. Upcoming rounds will be broadcast live.
            </div>
          )}
        </section>

        {/* Categories Section */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold text-zinc-950 dark:text-zinc-50">
            Tournament Categories
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{cat.name}</span>
                  <span className="rounded bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {cat.type}
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-500">Preset: {cat.rule_preset}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Rules & Guidelines (Graceful Degradation) */}
        {branding?.rules_markdown && (
          <section className="mb-10 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-base font-bold text-zinc-950 dark:text-zinc-50">
              Official Tournament Rules
            </h2>
            <div className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
              {branding.rules_markdown}
            </div>
          </section>
        )}
      </main>

      {/* Footer with subtle "Powered by ShuttleLive" */}
      <footer className="border-t border-zinc-200 bg-zinc-50 py-8 text-center text-xs text-zinc-500 dark:border-zinc-900 dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl px-4">
          <p>© {new Date().getFullYear()} {tournament.name}. Organized by {tournament.organizer_display_name}.</p>
          <p className="mt-2 text-[11px] text-zinc-400">
            Powered by{" "}
            <Link href="/" className="font-semibold text-zinc-700 hover:text-emerald-600 dark:text-zinc-300">
              ShuttleLive
            </Link>{" "}
            · Badminton Tournament Operating System
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function TournamentMicrositePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <React.Suspense fallback={<div className="flex min-h-screen items-center justify-center text-xs text-zinc-400">Loading Tournament...</div>}>
      <TournamentContent params={params} />
    </React.Suspense>
  );
}
