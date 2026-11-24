import { Suspense } from "react";
import { StatusPill } from "@/components/app/ui";
import { PublishControls } from "@/components/dashboard/publish-controls";
import { TournamentTabs } from "@/components/dashboard/tournament-tabs";
import { getOwnedBundle } from "@/lib/data";
import { formatDateRange } from "@/lib/format";

export default function TournamentLayout({ children, params }: LayoutProps<"/dashboard/t/[id]">) {
  return (
    <>
      <Suspense fallback={<div className="h-28" />}>
        <Header params={params} />
      </Suspense>
      <div className="mt-8">{children}</div>
    </>
  );
}

async function Header({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tournament: t } = await getOwnedBundle(id);
  return (
    <header>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <StatusPill tone={t.status === "DRAFT" ? "draft" : t.status === "COMPLETED" ? "done" : "live"}>
              {t.status === "DRAFT" ? "Draft, only you can see it" : t.status === "COMPLETED" ? "Completed" : "Published"}
            </StatusPill>
          </div>
          <h1 className="mt-2 font-display text-[clamp(2.25rem,5vw,3.5rem)]">{t.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {formatDateRange(t.start_date, t.end_date)}
            {t.venue_name ? `, ${t.venue_name}` : ""}
          </p>
        </div>
        <PublishControls id={t.id} slug={t.slug} status={t.status} />
      </div>
      <div className="mt-6">
        <TournamentTabs id={t.id} />
      </div>
    </header>
  );
}
