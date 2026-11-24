import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/layout/app-icon";
import { LiveSections } from "@/components/tournament/live-sections";
import { ShareLinks } from "@/components/tournament/share-links";
import { getDraftForOwner, getPublicBundle, type Bundle } from "@/lib/data";
import { formatDateRange, siteUrl } from "@/lib/format";
import { mediaUrl } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const res = await getPublicBundle(slug);
  if (res.kind !== "ok") return { title: "Tournament not found", robots: { index: false, follow: false } };
  const t = res.bundle.tournament;
  const description =
    t.subtitle ?? `${formatDateRange(t.start_date, t.end_date)}${t.venue_name ? `, ${t.venue_name}` : ""}. Live scores, draws and results.`;
  return {
    title: t.name,
    description,
    robots: t.visibility === "UNLISTED" ? { index: false, follow: false } : undefined,
    // The share image comes from ./opengraph-image.tsx (name, dates and the live score).
    openGraph: { title: t.name, description, url: siteUrl(`/t/${t.slug}`) },
    twitter: { card: "summary_large_image", title: t.name, description },
  };
}

export default function PublicTournamentPage({ params }: PageProps<"/t/[slug]">) {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      <Suspense fallback={<p className="p-8 text-sm text-ink-soft">Loading tournament…</p>}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Shared, cached copy for everyone (no cookies involved).
  const res = await getPublicBundle(slug);
  if (res.kind === "redirect") permanentRedirect(`/t/${res.slug}`);
  if (res.kind === "ok") return <TournamentView bundle={res.bundle} draft={false} />;

  // Not public: it may be a draft the signed-in owner is previewing.
  const draft = await getDraftForOwner(slug);
  if (!draft) notFound();
  return <TournamentView bundle={draft} draft />;
}

function TournamentView({ bundle: b, draft }: { bundle: Bundle; draft: boolean }) {
  const t = b.tournament;
  const banner = mediaUrl(t.banner_path);
  const logo = mediaUrl(t.logo_path);

  return (
    <>
      {draft && (
        <p className="bg-warn/20 px-4 py-2 text-center text-sm">
          This is a draft. Only you can see it.{" "}
          <Link href={`/dashboard/t/${t.id}`} className="font-semibold underline underline-offset-4">
            Back to the dashboard
          </Link>
        </p>
      )}

      <header className="border-b border-line">
        {banner && (
          // eslint-disable-next-line @next/next/no-img-element -- organizer upload from storage
          <img src={banner} alt="" className="aspect-[3/1] max-h-80 w-full object-cover" />
        )}
        <div className="mx-auto flex max-w-6xl flex-wrap items-end gap-5 px-4 py-8 sm:px-6">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- organizer upload from storage
            <img
              src={logo}
              alt=""
              className={cn("size-20 rounded-lg border border-line bg-surface object-cover sm:size-24", banner && "-mt-16 sm:-mt-20")}
            />
          )}
          <div className="min-w-0 flex-1">
            {t.host_name && <p className="text-sm text-ink-soft">{t.host_name}</p>}
            <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)]">{t.name}</h1>
            {t.subtitle && <p className="mt-1 text-lg text-ink-soft">{t.subtitle}</p>}
            <p className="mt-3 text-sm">
              {formatDateRange(t.start_date, t.end_date)}
              {t.venue_name && (
                <>
                  , {t.venue_name}
                  {t.venue_address ? `, ${t.venue_address}` : ""}
                </>
              )}
              {t.venue_map_url && (
                <>
                  {" "}
                  <a
                    href={t.venue_map_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="font-semibold text-court underline underline-offset-4"
                  >
                    Directions
                  </a>
                </>
              )}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-12 px-4 py-10 sm:px-6">
        <LiveSections
          tournamentId={t.id}
          completed={t.status === "COMPLETED"}
          initialMatches={b.matches}
          entries={b.entries}
          courts={b.courts}
          categories={b.categories}
        />

        {t.description && (
          <section>
            <h2 className="font-display text-3xl">About</h2>
            <p className="mt-3 max-w-[70ch] leading-relaxed whitespace-pre-line text-ink-soft">{t.description}</p>
          </section>
        )}

        {!draft && <ShareLinks url={siteUrl(`/t/${t.slug}`)} title={t.name} />}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-6 text-sm text-ink-soft sm:px-6">
          <span>Powered by</span>
          <Logo />
        </div>
      </footer>
    </>
  );
}
