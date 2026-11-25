import Link from "next/link";
import { Suspense } from "react";
import { LandingNavbar } from "@/components/landing/navbar";
import { HeroCta } from "@/components/landing/hero-cta";
import { CourtScoreboard } from "@/components/landing/court-scoreboard";
import { TournamentBrowser } from "@/components/landing/tournament-browser";
import { LogoFull } from "@/components/layout/app-icon";
import { CourtLines } from "@/components/court/court-lines";
import { listPublicTournaments } from "@/lib/data";

const ROLES = [
  {
    who: "Players & fans",
    title: "Follow every court from one link",
    body: "Live scores, fixtures, brackets and results on your phone — no app or account required.",
  },
  {
    who: "Organizers",
    title: "Set up the whole event",
    body: "Add players by hand or CSV, choose categories and scoring, generate the draw and schedule courts.",
  },
  {
    who: "On match day",
    title: "Score from the side of the court",
    body: "Open a match on your phone and tap the side that won each rally. Serve, intervals and deuce are tracked automatically.",
  },
];

async function TournamentDirectory() {
  const tournaments = await listPublicTournaments();
  return <TournamentBrowser tournaments={tournaments} />;
}

function DirectorySkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-11 max-w-md animate-pulse rounded-lg bg-surface-2" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-xl border border-line bg-surface-2" />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      <LandingNavbar />

      <main className="flex-1">
        {/* Spectator-first hero */}
        <section className="mx-auto max-w-6xl px-4 pt-10 pb-8 sm:px-6 sm:pt-14">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-semibold text-court">
                <span className="size-2 rounded-full bg-live" aria-hidden="true" />
                Live badminton scoreboard &amp; draws
              </p>
              <h1 className="mt-4 font-display text-[clamp(2.5rem,5.5vw,4.25rem)] text-ink">
                Find tournaments. Follow every court live.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
                Browse ongoing and upcoming badminton tournaments, search by club or venue, and
                watch live scores, draws and results — no account needed.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
              <Link
                href="#organizers"
                className="rounded-md border border-line bg-surface-2 px-4 py-2.5 font-medium text-ink hover:bg-line"
              >
                Organizing an event?
              </Link>
            </div>
          </div>
        </section>

        {/* Public tournament search & live directory */}
        <section id="tournaments" className="mx-auto max-w-6xl px-4 pt-2 pb-16 sm:px-6 lg:pb-24">
          <Suspense fallback={<DirectorySkeleton />}>
            <TournamentDirectory />
          </Suspense>
        </section>

        {/* Who it's for */}
        <section className="border-t border-line bg-surface-2">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line lg:py-20">
            {ROLES.map((r) => (
              <div key={r.who} className="md:px-8 md:first:pl-0 md:last:pr-0">
                <p className="text-sm font-semibold text-court">{r.who}</p>
                <h2 className="mt-2 font-display text-[2rem] text-ink">{r.title}</h2>
                <p className="mt-3 leading-relaxed text-ink-soft">{r.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* For organizers: interactive scoring demo + CTA */}
        <section id="organizers" className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_440px] lg:items-center lg:gap-16 lg:py-24">
            <div>
              <p className="text-sm font-semibold text-court">For organizers &amp; clubs</p>
              <h2 className="mt-2 font-display text-[clamp(2.25rem,5vw,3.75rem)] text-ink">
                Run the tournament. Everyone follows the score.
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-soft">
                ShuttleLive handles draws, court schedules and one-tap scoring for your event, and
                publishes a live public page anyone can search and open.
              </p>
              <HeroCta />
              <p className="mt-10 max-w-sm border-l-2 border-court pl-4 text-sm leading-relaxed text-ink-soft">
                Try the scoring screen beside this. Tap +1 to give a player the rally — score,
                serve and service box update the way they do on court.
              </p>
            </div>

            <CourtScoreboard />
          </div>
        </section>

        {/* Closing banner */}
        <section className="relative overflow-hidden bg-court-deep text-court-line">
          <CourtLines
            orientation="vertical"
            className="pointer-events-none absolute -right-24 -bottom-40 h-[140%] w-auto opacity-15"
          />
          <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between lg:py-20">
            <div>
              <h2 className="font-display text-[clamp(2rem,4.5vw,3.25rem)]">
                Your next tournament can be live by the weekend
              </h2>
              <p className="mt-2 max-w-md text-sm opacity-85 sm:text-base">
                Create your event, publish the draws, and let players and fans follow every rally.
              </p>
            </div>
            <Link
              href="/sign-up"
              className="shrink-0 self-start rounded-md bg-court-line px-6 py-3 text-sm font-semibold text-court-deep hover:bg-surface-2 md:self-auto"
            >
              Create a tournament
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link href="/" aria-label="ShuttleLive home" className="w-fit rounded-md">
            <LogoFull className="w-32" />
          </Link>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
            <Link href="/#tournaments" className="hover:text-ink">
              Tournaments
            </Link>
            <Link href="/sign-up" className="hover:text-ink">
              Create a tournament
            </Link>
            <Link href="/sign-in" className="hover:text-ink">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
