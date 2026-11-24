import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { CourtScoreboard } from "@/components/landing/court-scoreboard";
import { LogoFull } from "@/components/layout/app-icon";
import { CourtLines } from "@/components/court/court-lines";

const ROLES = [
  {
    who: "Organizers",
    title: "Set up the whole event",
    body: "Add players by hand or from a spreadsheet, choose categories and scoring, generate the draw and give each court its order of play.",
  },
  {
    who: "Umpires",
    title: "Score from the side of the court",
    body: "Open the PIN you were given and tap the side that won each rally. Serving side, intervals, deuce and game point are tracked for you.",
  },
  {
    who: "Players and fans",
    title: "Follow every court from one link",
    body: "Live scores, fixtures, brackets and results on a phone, no app or account. Put it on the hall projector for everyone waiting.",
  },
];

const STEPS = [
  { title: "Create the event", body: "Name, dates, venue and categories such as men's singles or mixed doubles." },
  { title: "Add the entries", body: "Type players in or import a CSV. Group them by team or club." },
  { title: "Make the draw", body: "Knockout brackets with byes worked out for you, or copy in a draw you already made on paper." },
  { title: "Run the courts", body: "See who is on court and who is next. Players booked on two courts at once are flagged." },
  { title: "Crown the champions", body: "Results lock when the umpire confirms. Winners appear on the event page for good." },
];

const FORMATS = [
  { name: "Best of 3 to 21", note: "BWF standard", rules: "Win by two, capped at 30. Interval at 11." },
  { name: "Best of 3 to 15", note: "Domestic format", rules: "Win by two, capped at 21. Interval at 8." },
  { name: "One game to 21", note: "Quick knockout", rules: "For big draws and short days." },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      <LandingNavbar />

      <main className="flex-1">
        {/* Hero: headline beside the umpire's scoring screen */}
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 lg:grid-cols-[1fr_440px] lg:items-center lg:gap-16 lg:pb-24">
          <div>
            <h1 className="font-display text-[clamp(3rem,6.5vw,5.5rem)] text-ink">
              Run the tournament. Everyone follows the score.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
              ShuttleLive handles the draw, the courts and the scoring for badminton
              tournaments, and gives every event a live page anyone can open.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/sign-up"
                className="rounded-md bg-court px-5 py-3 text-sm font-semibold text-court-line hover:bg-court-deep"
              >
                Create a tournament
              </Link>
              <Link
                href="/sign-in?mode=umpire"
                className="rounded-md border border-line px-5 py-3 text-sm font-semibold text-ink hover:border-ink"
              >
                Enter umpire PIN
              </Link>
            </div>
            <p className="mt-10 max-w-sm border-l-2 border-court pl-4 text-sm leading-relaxed text-ink-soft">
              The panel beside this is the umpire&apos;s screen. Tap +1 to give a player the
              rally. The score, serve and service box update the way they do on court.
            </p>
          </div>

          <CourtScoreboard />
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

        {/* The sequence of a tournament */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <h2 className="max-w-xl font-display text-[clamp(2.25rem,5vw,3.75rem)]">
            From the first entry to the final point
          </h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-5 md:gap-0">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative md:pr-6">
                <div className="flex items-center gap-3 md:block">
                  <span className="font-score flex size-11 items-center justify-center rounded-full border-2 border-court text-2xl text-court">
                    {i + 1}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute top-[21px] left-12 hidden h-0.5 w-[calc(100%-3.5rem)] bg-court/30 md:block"
                    />
                  )}
                  <h3 className="text-lg font-semibold md:mt-5">{s.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Scoring formats + event page */}
        <section className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-14 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
            <div>
              <h2 className="font-display text-[clamp(2.25rem,4.5vw,3.25rem)]">
                The scoring rules you already play
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-ink-soft">
                Pick a format per category. The scoreboard knows when it&apos;s game point, when
                to take the interval and when to change ends.
              </p>
              <dl className="mt-8 divide-y divide-line border-y border-line">
                {FORMATS.map((f) => (
                  <div key={f.name} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-5">
                    <dt className="font-display text-2xl">{f.name}</dt>
                    <dd className="text-sm text-ink-soft sm:row-span-2 sm:self-center">{f.note}</dd>
                    <dd className="col-span-2 text-sm text-ink-soft sm:col-span-1">{f.rules}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <h2 className="font-display text-[clamp(2.25rem,4.5vw,3.25rem)]">
                Every event gets its own page
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-ink-soft">
                Add your logo, banner, colours, venue and sponsors. Sections you leave empty
                stay hidden, so a weekend knockout looks as finished as a city championship.
              </p>

              {/* Event page preview, shown in a host's own colour */}
              <figure className="mt-8 overflow-hidden rounded-lg border border-line bg-surface shadow-[0_1px_0_var(--line),0_24px_48px_-24px_color-mix(in_oklab,var(--ink)_25%,transparent)]">
                <div className="border-b border-line bg-surface-2 px-4 py-2 text-xs text-ink-soft">
                  shuttlelive.app/t/riverside-winter-open
                </div>
                <div className="bg-ink px-5 py-6 text-on-dark">
                  <p className="text-xs opacity-70">Riverside Badminton Club</p>
                  <p className="mt-1 font-display text-3xl">Winter Open 2026</p>
                  <p className="mt-2 flex items-center gap-2 text-xs">
                    <span className="size-2 rounded-full bg-live" />
                    Live now, 2 courts in play
                  </p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-line">
                  {[
                    { court: "Court 1", a: "Aman Kumar", b: "Rahul Sharma", sa: 18, sb: 16 },
                    { court: "Court 2", a: "Ravi / Vivek", b: "Rohit / Ankit", sa: 12, sb: 14 },
                  ].map((m) => (
                    <div key={m.court} className="p-4 text-sm">
                      <p className="text-xs text-ink-soft">{m.court}</p>
                      <p className="mt-2 flex justify-between gap-2">
                        <span className="truncate">{m.a}</span>
                        <span className="font-score text-xl">{m.sa}</span>
                      </p>
                      <p className="mt-1 flex justify-between gap-2">
                        <span className="truncate">{m.b}</span>
                        <span className="font-score text-xl">{m.sb}</span>
                      </p>
                    </div>
                  ))}
                </div>
                <figcaption className="sr-only">
                  Preview of a tournament page with live court scores
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* Umpire PIN */}
        <section className="relative overflow-hidden bg-court-deep text-court-line">
          <CourtLines
            orientation="vertical"
            className="pointer-events-none absolute -right-24 -bottom-40 h-[140%] w-auto opacity-15"
          />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center lg:py-24">
            <div>
              <h2 className="font-display text-[clamp(2.25rem,5vw,3.75rem)]">
                Give umpires a PIN, not a password
              </h2>
              <p className="mt-4 max-w-md leading-relaxed opacity-85">
                Each court gets a six-digit PIN. Any volunteer can type it on their own phone
                and start scoring that match. Mistakes can be undone point by point, and every
                change is kept in the match record.
              </p>
              <Link
                href="/sign-in?mode=umpire"
                className="mt-8 inline-block rounded-md bg-court-line px-5 py-3 text-sm font-semibold text-court-deep hover:bg-surface-2"
              >
                Enter umpire PIN
              </Link>
            </div>
            <div className="flex gap-2 sm:gap-3 md:justify-end" aria-hidden="true">
              {["8", "4", "9", "2", "0", "1"].map((d, i) => (
                <span
                  key={i}
                  className="font-score flex h-16 w-11 items-center justify-center rounded-md border border-court-line/40 text-4xl sm:h-20 sm:w-14 sm:text-5xl"
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <h2 className="max-w-2xl font-display text-[clamp(2.5rem,6vw,4.5rem)]">
              Your next tournament can be live by the weekend
            </h2>
            <Link
              href="/sign-up"
              className="shrink-0 self-start rounded-md bg-court px-6 py-3.5 text-sm font-semibold text-court-line hover:bg-court-deep md:self-auto"
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
            <Link href="/sign-up" className="hover:text-ink">Create a tournament</Link>
            <Link href="/sign-in?mode=umpire" className="hover:text-ink">Enter umpire PIN</Link>
            <Link href="/sign-in" className="hover:text-ink">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
