import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/layout/app-icon";
import { Bracket } from "@/components/tournament/bracket";
import { LiveRefresh } from "@/components/tournament/live-refresh";
import { ShareLinks } from "@/components/tournament/share-links";
import { getPublicBundle, type Bundle } from "@/lib/data";
import { formatDateRange, siteUrl } from "@/lib/format";
import { REASON_LABEL, callout, isActive, isDone, roundName } from "@/lib/scoring";
import { mediaUrl } from "@/lib/supabase/env";
import type { MatchWithGames } from "@/lib/types";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const res = await getPublicBundle(slug);
  if (res.kind !== "ok") return { title: "Tournament not found" };
  const t = res.bundle.tournament;
  const banner = mediaUrl(t.banner_path) ?? mediaUrl(t.logo_path);
  const description =
    t.subtitle ?? `${formatDateRange(t.start_date, t.end_date)}${t.venue_name ? `, ${t.venue_name}` : ""}. Live scores, draws and results.`;
  return {
    title: t.name,
    description,
    robots: t.visibility === "UNLISTED" || t.status === "DRAFT" ? { index: false, follow: false } : undefined,
    openGraph: { title: t.name, description, url: siteUrl(`/t/${t.slug}`), images: banner ? [banner] : undefined },
    twitter: { card: banner ? "summary_large_image" : "summary", title: t.name, description },
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
  const res = await getPublicBundle(slug);
  if (res.kind === "redirect") permanentRedirect(`/t/${res.slug}`);
  if (res.kind === "missing") notFound();
  return <TournamentView bundle={res.bundle} isOwner={res.isOwner} />;
}

function TournamentView({ bundle: b, isOwner }: { bundle: Bundle; isOwner: boolean }) {
  const t = b.tournament;
  const names = Object.fromEntries(b.entries.map((e) => [e.id, e.display_name]));
  const courtName = Object.fromEntries(b.courts.map((c) => [c.id, c.name]));
  const catName = Object.fromEntries(b.categories.map((c) => [c.id, c.name]));
  const rounds: Record<string, number> = {};
  for (const m of b.matches) if (m.position !== null) rounds[m.category_id] = Math.max(rounds[m.category_id] ?? 0, m.round);
  const label = (m: MatchWithGames) =>
    `${catName[m.category_id]}${m.position !== null ? `, ${roundName(m.round, rounds[m.category_id] ?? m.round)}` : ""}`;

  const live = b.matches.filter(isActive);
  const next = b.matches.filter((m) => m.status === "SCHEDULED" && m.entry_a_id && m.entry_b_id);
  const results = b.matches
    .filter((m) => isDone(m) && m.result_reason !== "BYE")
    .sort((x, y) => (y.finished_at ?? "").localeCompare(x.finished_at ?? ""));
  const banner = mediaUrl(t.banner_path);
  const logo = mediaUrl(t.logo_path);

  // Champions: winners of each category's final.
  const champions = b.categories
    .map((c) => {
      const final = b.matches.find((m) => m.category_id === c.id && m.position !== null && m.round === rounds[c.id] && isDone(m));
      const winner = final?.winner_side ? (final.winner_side === "A" ? final.entry_a_id : final.entry_b_id) : null;
      return winner ? { category: c.name, name: names[winner] } : null;
    })
    .filter(Boolean) as { category: string; name: string }[];

  return (
    <>
      {t.status === "DRAFT" && isOwner && (
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
            <img src={logo} alt="" className={cn("size-20 rounded-lg border border-line bg-surface object-cover sm:size-24", banner && "-mt-16 sm:-mt-20")} />
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
                  <a href={t.venue_map_url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-court underline underline-offset-4">
                    Directions
                  </a>
                </>
              )}
            </p>
          </div>
          {t.status !== "COMPLETED" && <LiveRefresh tournamentId={t.id} />}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-12 px-4 py-10 sm:px-6">
        {champions.length > 0 && (
          <section>
            <h2 className="font-display text-3xl">Champions</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {champions.map((c) => (
                <li key={c.category} className="rounded-md bg-court px-4 py-3 text-court-line">
                  <p className="text-sm opacity-85">{c.category}</p>
                  <p className="font-display text-2xl">{c.name}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {live.length > 0 && (
          <section>
            <h2 className="font-display text-3xl">On court now</h2>
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {live.map((m) => (
                <LiveCard key={m.id} m={m} names={names} court={m.court_id ? courtName[m.court_id] : null} label={label(m)} />
              ))}
            </ul>
          </section>
        )}

        {next.length > 0 && (
          <section>
            <h2 className="font-display text-3xl">Up next</h2>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {next.slice(0, 12).map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {names[m.entry_a_id!]} <span className="text-ink-soft">v</span> {names[m.entry_b_id!]}
                    </span>
                    <span className="text-sm text-ink-soft">{label(m)}</span>
                  </span>
                  {m.court_id && <span className="text-sm font-semibold">{courtName[m.court_id]}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {results.length > 0 && (
          <section>
            <h2 className="font-display text-3xl">Results</h2>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {results.slice(0, 30).map((m) => {
                const winnerId = m.winner_side === "A" ? m.entry_a_id : m.entry_b_id;
                const loserId = m.winner_side === "A" ? m.entry_b_id : m.entry_a_id;
                return (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span className="min-w-0">
                      <span className="block truncate">
                        <strong>{winnerId ? names[winnerId] : "?"}</strong> beat {loserId ? names[loserId] : "?"}
                      </span>
                      <span className="text-sm text-ink-soft">{label(m)}</span>
                    </span>
                    <span className="font-score text-xl">
                      {m.result_reason && m.result_reason !== "NORMAL"
                        ? REASON_LABEL[m.result_reason]
                        : m.games.map((g) => (m.winner_side === "A" ? `${g.score_a}–${g.score_b}` : `${g.score_b}–${g.score_a}`)).join(", ")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {b.categories.map((c) => {
          const drawn = b.matches.filter((m) => m.category_id === c.id && m.position !== null);
          if (!drawn.length) return null;
          return (
            <section key={c.id}>
              <h2 className="font-display text-3xl">{c.name}</h2>
              <div className="mt-4">
                <Bracket matches={drawn} names={names} />
              </div>
            </section>
          );
        })}

        {!b.matches.length && (
          <p className="rounded-md bg-surface-2 px-4 py-6 text-center text-ink-soft">
            The draw hasn&apos;t been published yet. Check back closer to the start.
          </p>
        )}

        {t.description && (
          <section>
            <h2 className="font-display text-3xl">About</h2>
            <p className="mt-3 max-w-[70ch] leading-relaxed whitespace-pre-line text-ink-soft">{t.description}</p>
          </section>
        )}

        {t.status !== "DRAFT" && <ShareLinks url={siteUrl(`/t/${t.slug}`)} title={t.name} />}
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

function LiveCard({ m, names, court, label }: { m: MatchWithGames; names: Record<string, string>; court: string | null; label: string }) {
  const n = { A: names[m.entry_a_id!], B: names[m.entry_b_id!] };
  const call = callout(m, n);
  return (
    <li className="rounded-lg border border-live p-4">
      <p className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold">{court ?? "Court not set"}</span>
        <span className="text-ink-soft">{label}</span>
      </p>
      {(["A", "B"] as const).map((side) => (
        <div key={side} className="mt-3 flex items-center gap-3">
          <span className={cn("size-2 shrink-0 rounded-full", m.serving_side === side && m.status === "LIVE" ? "bg-live" : "bg-transparent")} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-medium">{n[side]}</span>
          <span className="font-score flex gap-3 text-ink-soft">
            {m.games
              .filter((g) => g.game_number < m.current_game || m.status !== "LIVE")
              .map((g) => (
                <span key={g.game_number} className="text-xl">{side === "A" ? g.score_a : g.score_b}</span>
              ))}
          </span>
          <span className="font-score w-[2ch] text-right text-5xl">{side === "A" ? m.score_a : m.score_b}</span>
        </div>
      ))}
      {call && <p className="mt-3 text-sm font-semibold text-warn">{call}</p>}
    </li>
  );
}
