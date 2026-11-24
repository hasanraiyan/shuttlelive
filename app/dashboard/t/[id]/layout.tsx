import { Suspense } from "react";
import { StatusPill } from "@/components/app/ui";
import { PublishControls } from "@/components/dashboard/publish-controls";
import { TournamentProvider } from "@/components/dashboard/tournament-context";
import { TournamentTabs } from "@/components/dashboard/tournament-tabs";
import { getOwnedBundle, listMyOrganizations } from "@/lib/data";
import { ShareLinks } from "@/components/tournament/share-links";
import { formatDateRange, siteUrl } from "@/lib/format";

/**
 * Loads the tournament once (one database round trip) and shares it with every
 * tab through TournamentProvider. The layout isn't re-rendered when you switch
 * tabs, so tab changes cost no server or database work. Server actions refresh
 * it after a change.
 */
export default function TournamentLayout({ children, params }: LayoutProps<"/dashboard/t/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Loading tournament…</p>}>
      <Loader params={params}>{children}</Loader>
    </Suspense>
  );
}

async function Loader({ params, children }: { params: Promise<{ id: string }>; children: React.ReactNode }) {
  const { id } = await params;
  const [bundle, orgs] = await Promise.all([getOwnedBundle(id), listMyOrganizations()]);
  const myOrgs = orgs.map((o) => ({ id: o.id, name: o.name }));
  const t = bundle.tournament;
  const team = bundle.organization ? `${bundle.organization.name} team` : null;

  if (t.kind === "QUICK") {
    const m = bundle.matches[0];
    return (
      <TournamentProvider initial={bundle} myOrgs={myOrgs}>
        <header className="print:hidden">
          <StatusPill tone="plain">Quick match</StatusPill>
          <h1 className="mt-2 font-display text-[clamp(2rem,4.5vw,3rem)]">{t.name}</h1>
          {m && (
            <div className="mt-4">
              <ShareLinks url={siteUrl(`/t/${t.slug}/m/${m.id}`)} title={t.name} />
            </div>
          )}
        </header>
        <div className="mt-8">{children}</div>
      </TournamentProvider>
    );
  }

  return (
    <TournamentProvider initial={bundle} myOrgs={myOrgs}>
      <header className="print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <StatusPill tone={t.status === "DRAFT" ? "draft" : t.status === "COMPLETED" ? "done" : "live"}>
              {t.status === "DRAFT"
                ? `Draft, only ${team ? "your team" : "you"} can see it`
                : t.status === "COMPLETED"
                  ? "Completed"
                  : "Published"}
            </StatusPill>
            <h1 className="mt-2 font-display text-[clamp(2.25rem,5vw,3.5rem)]">{t.name}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {formatDateRange(t.start_date, t.end_date)}
              {t.venue_name ? `, ${t.venue_name}` : ""}
              {bundle.organization ? `. ${bundle.organization.name}` : ""}
            </p>
          </div>
          <PublishControls id={t.id} slug={t.slug} status={t.status} />
        </div>
        <div className="mt-6">
          <TournamentTabs id={t.id} />
        </div>
      </header>
      <div className="mt-8">{children}</div>
    </TournamentProvider>
  );
}
