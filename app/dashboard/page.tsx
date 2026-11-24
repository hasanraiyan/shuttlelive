import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, StatusPill } from "@/components/app/ui";
import { listManagedTournaments } from "@/lib/data";
import { formatDateRange } from "@/lib/format";
import type { Tournament } from "@/lib/types";

export const metadata = { title: "Your tournaments" };

export default function DashboardPage() {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-5xl">Your tournaments</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/quick"
            className="inline-flex h-10 items-center rounded-md border border-line px-4 text-sm font-semibold hover:border-ink"
          >
            Quick match
          </Link>
          <Link
            href="/dashboard/new"
            className="inline-flex h-10 items-center rounded-md bg-court px-4 text-sm font-semibold text-court-line hover:bg-court-deep"
          >
            Create a tournament
          </Link>
        </div>
      </div>
      <Suspense fallback={<p className="mt-8 text-sm text-ink-soft">Loading your tournaments…</p>}>
        <Lists />
      </Suspense>
    </>
  );
}

async function Lists() {
  const { tournaments, orgs } = await listManagedTournaments();
  const events = tournaments.filter((t) => t.kind === "TOURNAMENT");
  const quick = tournaments.filter((t) => t.kind === "QUICK").slice(0, 10);
  const personal = events.filter((t) => !t.organization_id);

  if (!tournaments.length) {
    return (
      <div className="mt-8">
        <EmptyState title="No tournaments yet">
          Create your first one, or start a quick match to score a single game right away.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-10">
      {personal.length > 0 && <Group title={orgs.length ? "Personal" : null} items={personal} />}
      {orgs.map((o) => {
        const items = events.filter((t) => t.organization_id === o.id);
        return (
          <Group
            key={o.id}
            title={o.name}
            href={`/dashboard/orgs/${o.id}`}
            items={items}
            empty="No tournaments in this organization yet."
          />
        );
      })}
      {quick.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-2xl">Quick matches</h2>
          <ul className="divide-y divide-line border-y border-line">
            {quick.map((t) => (
              <li key={t.id}>
                <Link href={`/dashboard/t/${t.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-surface-2 sm:px-3">
                  <span className="truncate font-medium">{t.name}</span>
                  <span className="shrink-0 text-sm text-ink-soft">{formatDateRange(t.start_date, t.end_date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Group({ title, href, items, empty }: { title: string | null; href?: string; items: Tournament[]; empty?: string }) {
  return (
    <section>
      {title && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl">{title}</h2>
          {href && (
            <Link href={href} className="text-sm font-semibold text-ink-soft hover:text-ink">
              Organization settings
            </Link>
          )}
        </div>
      )}
      {items.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((t) => (
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
      ) : (
        <p className="text-sm text-ink-soft">{empty}</p>
      )}
    </section>
  );
}
