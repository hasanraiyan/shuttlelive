import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, StatusPill } from "@/components/app/ui";
import { listOwnedTournaments } from "@/lib/data";
import { formatDateRange } from "@/lib/format";

export const metadata = { title: "Your tournaments" };

export default function DashboardPage() {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-5xl">Your tournaments</h1>
        <Link
          href="/dashboard/new"
          className="inline-flex h-10 items-center rounded-md bg-court px-4 text-sm font-semibold text-court-line hover:bg-court-deep"
        >
          Create a tournament
        </Link>
      </div>
      <Suspense fallback={<p className="mt-8 text-sm text-ink-soft">Loading your tournaments…</p>}>
        <TournamentList />
      </Suspense>
    </>
  );
}

async function TournamentList() {
  const tournaments = await listOwnedTournaments();
  if (!tournaments.length) {
    return (
      <div className="mt-8">
        <EmptyState title="No tournaments yet">
          Create your first one. You can add players, make the draw and score matches from here.
        </EmptyState>
      </div>
    );
  }
  return (
    <ul className="mt-8 divide-y divide-line border-y border-line">
      {tournaments.map((t) => (
        <li key={t.id}>
          <Link href={`/dashboard/t/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-surface-2 sm:px-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{t.name}</p>
              <p className="text-sm text-ink-soft">
                {formatDateRange(t.start_date, t.end_date)}
                {t.venue_name ? `, ${t.venue_name}` : ""}
              </p>
            </div>
            <StatusPill tone={t.status === "DRAFT" ? "draft" : t.status === "COMPLETED" ? "done" : "live"}>
              {t.status === "DRAFT" ? "Draft" : t.status === "COMPLETED" ? "Completed" : "Published"}
            </StatusPill>
          </Link>
        </li>
      ))}
    </ul>
  );
}
