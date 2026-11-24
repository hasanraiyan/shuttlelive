import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/layout/app-icon";
import { MatchCenter } from "@/components/tournament/match-center";
import { brandVars } from "@/lib/color";
import { getDraftCommentary, getPublicBundle, getPublicCommentary } from "@/lib/data";
import { resolvePublic } from "@/lib/public";
import { siteUrl } from "@/lib/format";
import { roundName } from "@/lib/scoring";

export async function generateMetadata({ params }: PageProps<"/t/[slug]/m/[matchId]">): Promise<Metadata> {
  const { slug, matchId } = await params;
  const res = await getPublicBundle(slug);
  if (res.kind !== "ok") return { title: "Match", robots: { index: false, follow: false } };
  const b = res.bundle;
  const m = b.matches.find((x) => x.id === matchId);
  const name = (id: string | null) => b.entries.find((e) => e.id === id)?.display_name ?? "";
  const title = m ? `${name(m.entry_a_id)} v ${name(m.entry_b_id)}` : "Match";
  return {
    title: b.tournament.kind === "QUICK" ? title : `${title} · ${b.tournament.name}`,
    description: "Live score and commentary on ShuttleLive.",
    robots: { index: false, follow: true },
  };
}

export default function MatchPage({ params }: PageProps<"/t/[slug]/m/[matchId]">) {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      <Suspense fallback={<p className="p-8 text-sm text-ink-soft">Loading match…</p>}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ slug: string; matchId: string }> }) {
  const { slug, matchId } = await params;
  const { bundle: b, draft } = await resolvePublic(slug, `/m/${matchId}`);
  const m = b.matches.find((x) => x.id === matchId);
  if (!m || !m.entry_a_id || !m.entry_b_id) notFound();

  const events = draft ? await getDraftCommentary(m.id) : await getPublicCommentary(b.tournament.id, m.id);
  const name = (id: string) => b.entries.find((e) => e.id === id)?.display_name ?? "";
  const category = b.categories.find((c) => c.id === m.category_id);
  const rounds = Math.max(0, ...b.matches.filter((x) => x.category_id === m.category_id && x.position !== null).map((x) => x.round));
  const quick = b.tournament.kind === "QUICK";
  const context = quick
    ? `${category?.kind === "DOUBLES" ? "Doubles" : "Singles"} match`
    : `${category?.name ?? ""}${m.position !== null ? `, ${roundName(m.round, rounds)}` : ""}`;

  return (
    <div className="flex flex-1 flex-col" style={brandVars(b.tournament.brand_primary, b.tournament.brand_accent)}>
      {draft && <p className="bg-warn/20 px-4 py-2 text-center text-sm">This is a draft. Only you and your team can see it.</p>}
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <MatchCenter
          tournamentId={b.tournament.id}
          backHref={quick ? "/" : `/t/${b.tournament.slug}`}
          backLabel={quick ? "ShuttleLive" : b.tournament.name}
          shareUrl={siteUrl(`/t/${b.tournament.slug}/m/${m.id}`)}
          shareTitle={`${name(m.entry_a_id)} v ${name(m.entry_b_id)}`}
          initial={m}
          initialEvents={events}
          names={{ A: name(m.entry_a_id), B: name(m.entry_b_id) }}
          context={context}
          courtName={b.courts.find((c) => c.id === m.court_id)?.name ?? null}
        />
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-6 text-sm text-ink-soft sm:px-6">
          <span>Powered by</span>
          <Logo />
        </div>
      </footer>
    </div>
  );
}
