"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Calendar, MapPin, Search, Trophy, X } from "lucide-react";
import type { PublicTournamentSummary } from "@/lib/data";
import { formatDateRange } from "@/lib/format";
import { mediaUrl } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "live" | "upcoming" | "completed";

function classifyTournament(t: PublicTournamentSummary, today: string): Exclude<FilterTab, "all"> {
  if (t.liveMatches.length > 0) return "live";
  if (t.status === "COMPLETED") return "completed";
  if (t.startDate > today) return "upcoming";
  if (t.endDate < today) return "completed";
  return "live";
}

function sortTournaments(list: PublicTournamentSummary[], today: string) {
  const rank = { live: 0, upcoming: 1, completed: 2 } as const;
  return [...list].sort((a, b) => {
    const ka = classifyTournament(a, today);
    const kb = classifyTournament(b, today);
    if (rank[ka] !== rank[kb]) return rank[ka] - rank[kb];
    if (ka === "live") {
      if (b.liveMatches.length !== a.liveMatches.length) {
        return b.liveMatches.length - a.liveMatches.length;
      }
      return b.startDate.localeCompare(a.startDate);
    }
    if (ka === "upcoming") {
      return a.startDate.localeCompare(b.startDate);
    }
    return b.endDate.localeCompare(a.endDate);
  });
}

export function TournamentBrowser({ tournaments }: { tournaments: PublicTournamentSummary[] }) {
  const [query, setQuery] = React.useState("");
  const [tab, setTab] = React.useState<FilterTab>("all");
  const [today] = React.useState(() => new Date().toISOString().slice(0, 10));

  const ordered = React.useMemo(() => sortTournaments(tournaments, today), [tournaments, today]);

  const counts = React.useMemo(() => {
    const c = { all: ordered.length, live: 0, upcoming: 0, completed: 0 };
    for (const t of ordered) {
      c[classifyTournament(t, today)] += 1;
    }
    return c;
  }, [ordered, today]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return ordered.filter((t) => {
      const kind = classifyTournament(t, today);
      if (tab !== "all" && kind !== tab) return false;
      if (!q) return true;
      const haystack = [
        t.name,
        t.subtitle,
        t.hostName,
        t.venueName,
        t.venueAddress,
        ...t.liveMatches.flatMap((m) => [m.playerA, m.playerB]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [ordered, query, tab, today]);

  const tabs: { id: FilterTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "live", label: "Live & Ongoing", count: counts.live },
    { id: "upcoming", label: "Upcoming", count: counts.upcoming },
    { id: "completed", label: "Completed", count: counts.completed },
  ];

  return (
    <div>
      {/* Search + filter controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 md:max-w-md">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tournaments, venues, clubs, or players..."
            aria-label="Search tournaments"
            className="h-11 w-full rounded-lg border border-line bg-surface pr-10 pl-10 text-sm text-ink placeholder:text-ink-soft focus:border-court focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-ink-soft hover:bg-surface-2 hover:text-ink"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter tournaments by status">
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-ink bg-ink text-surface"
                    : "border-line bg-surface text-ink-soft hover:border-ink/30 hover:text-ink"
                )}
              >
                {item.id === "live" && item.count > 0 && (
                  <span className="size-2 rounded-full bg-live" aria-hidden="true" />
                )}
                <span>{item.label}</span>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    active ? "opacity-75" : "text-ink-soft"
                  )}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {tournaments.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-line bg-surface-2 px-6 py-14 text-center">
          <Trophy className="mx-auto size-8 text-ink-soft" aria-hidden="true" />
          <h3 className="mt-3 font-display text-2xl text-ink">No public tournaments yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
            When clubs publish their tournaments on ShuttleLive, they will appear here for players and fans to follow live.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-line bg-surface-2 px-6 py-12 text-center">
          <p className="font-display text-2xl text-ink">No matching tournaments</p>
          <p className="mt-1 text-sm text-ink-soft">
            Try a different tournament name, venue, or clear your active filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setTab("all");
            }}
            className="mt-4 inline-flex items-center rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TournamentCard key={t.id} tournament={t} kind={classifyTournament(t, today)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TournamentCard({
  tournament: t,
  kind,
}: {
  tournament: PublicTournamentSummary;
  kind: Exclude<FilterTab, "all">;
}) {
  const logo = mediaUrl(t.logoPath);
  const accent = t.brandPrimary ?? t.brandAccent;
  const hasLiveMatches = t.liveMatches.length > 0;
  const venue = [t.venueName, t.venueAddress].filter(Boolean).join(", ");

  return (
    <Link
      href={`/t/${t.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-all hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-[0_12px_32px_-16px_color-mix(in_oklab,var(--ink)_22%,transparent)]"
    >
      <div
        className="h-1.5 w-full bg-court"
        style={accent ? { backgroundColor: accent } : undefined}
        aria-hidden="true"
      />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element -- organizer upload from storage
              <img
                src={logo}
                alt=""
                className="size-10 shrink-0 rounded-lg border border-line bg-surface-2 object-cover"
              />
            )}
            <div className="min-w-0">
              {t.hostName && (
                <p className="truncate text-xs font-medium text-ink-soft">{t.hostName}</p>
              )}
              <StatusBadge kind={kind} liveCount={t.liveMatches.length} />
            </div>
          </div>
        </div>

        <h3 className="mt-3 font-display text-2xl text-ink group-hover:text-court">
          {t.name}
        </h3>
        {t.subtitle && (
          <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{t.subtitle}</p>
        )}

        <dl className="mt-4 space-y-1.5 text-xs text-ink-soft">
          <div className="flex items-center gap-2">
            <Calendar className="size-3.5 shrink-0" aria-hidden="true" />
            <dd>{formatDateRange(t.startDate, t.endDate)}</dd>
          </div>
          {venue && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <dd className="line-clamp-1">{venue}</dd>
            </div>
          )}
        </dl>

        {hasLiveMatches && (
          <div className="mt-4 space-y-2 rounded-lg border border-line bg-surface-2 p-3">
            {t.liveMatches.slice(0, 2).map((m) => (
              <div key={m.id} className="text-xs">
                <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-court">
                  <span>{m.courtName ?? "In play"}</span>
                  <span>Game {m.currentGame}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-ink">
                  <span className="truncate">{m.playerA}</span>
                  <span className="font-score text-base">{m.scoreA}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-ink">
                  <span className="truncate">{m.playerB}</span>
                  <span className="font-score text-base">{m.scoreB}</span>
                </div>
              </div>
            ))}
            {t.liveMatches.length > 2 && (
              <p className="text-[11px] font-medium text-ink-soft">
                +{t.liveMatches.length - 2} more {t.liveMatches.length - 2 === 1 ? "court" : "courts"} in play
              </p>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-4 text-xs font-semibold text-court">
          <span>
            {hasLiveMatches
              ? "Watch live scores"
              : kind === "completed"
                ? "View results & draws"
                : "View draws & schedule"}
          </span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({
  kind,
  liveCount,
}: {
  kind: Exclude<FilterTab, "all">;
  liveCount: number;
}) {
  if (liveCount > 0) {
    return (
      <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2.5 py-0.5 text-[11px] font-semibold text-court-deep">
        <span className="size-1.5 animate-pulse rounded-full bg-live" aria-hidden="true" />
        LIVE · {liveCount} {liveCount === 1 ? "court" : "courts"}
      </span>
    );
  }
  if (kind === "live") {
    return (
      <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2.5 py-0.5 text-[11px] font-semibold text-court-deep">
        <span className="size-1.5 rounded-full bg-live" aria-hidden="true" />
        Ongoing
      </span>
    );
  }
  if (kind === "upcoming") {
    return (
      <span className="mt-0.5 inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft">
        Upcoming
      </span>
    );
  }
  return (
    <span className="mt-0.5 inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
      Completed
    </span>
  );
}
