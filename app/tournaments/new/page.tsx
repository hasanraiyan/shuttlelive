"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppIcon } from "@/components/layout/app-icon";
import { createTournament } from "@/lib/actions/tournaments";

export default function NewTournamentPage() {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Form State
  const [name, setName] = React.useState("MIT Badminton Championship 2026");
  const [slug, setSlug] = React.useState("mit-badminton-2026");
  const [subtitle, setSubtitle] = React.useState("Annual College Badminton Competition");
  const [organizerDisplayName, setOrganizerDisplayName] = React.useState("MIT Muzaffarpur");
  const [venueName, setVenueName] = React.useState("College Badminton Court");
  const [venueAddress, setVenueAddress] = React.useState("Muzaffarpur, Bihar");
  const [startDate, setStartDate] = React.useState("2026-11-25");
  const [endDate, setEndDate] = React.useState("2026-11-27");
  const [courtCount, setCourtCount] = React.useState(2);
  const [visibility, setVisibility] = React.useState<"PUBLIC" | "UNLISTED" | "PRIVATE">("PUBLIC");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const tournament = await createTournament({
        name,
        slug,
        subtitle,
        organizerDisplayName,
        venueName,
        venueAddress,
        startDate,
        endDate,
        courtCount,
        visibility,
      });

      router.push(`/t/${tournament.slug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create tournament.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-950 antialiased dark:bg-zinc-950 dark:text-zinc-50">
      {/* Navbar */}
      <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold">
            <AppIcon className="size-5" />
            <span>ShuttleLive</span>
          </Link>
          <span className="text-xs font-semibold text-zinc-500">Tournament Creation Wizard</span>
        </div>
      </header>

      {/* Main Wizard Form */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          {/* Step Indicator */}
          <div className="mb-6 flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
            <div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                Step {step} of 2
              </span>
              <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100">
                {step === 1 ? "Basic Tournament Information" : "Courts & Visibility Settings"}
              </h1>
            </div>
            <div className="flex gap-1.5">
              <span className={`h-2 w-8 rounded-full ${step === 1 ? "bg-emerald-600" : "bg-zinc-200 dark:bg-zinc-700"}`} />
              <span className={`h-2 w-8 rounded-full ${step === 2 ? "bg-emerald-600" : "bg-zinc-200 dark:bg-zinc-700"}`} />
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-medium text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {step === 1 ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Tournament Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                    }}
                    placeholder="e.g. Annual Badminton Championship 2026"
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm text-zinc-900 outline-none focus:border-emerald-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Unique Shareable URL Slug *
                  </label>
                  <div className="flex items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 dark:border-zinc-800 dark:bg-zinc-950">
                    <span className="text-xs text-zinc-400">shuttlelive.com/t/</span>
                    <input
                      type="text"
                      required
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      className="h-11 w-full bg-transparent text-sm font-semibold text-zinc-900 outline-none dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Organizing Institution / Club *
                    </label>
                    <input
                      type="text"
                      required
                      value={organizerDisplayName}
                      onChange={(e) => setOrganizerDisplayName(e.target.value)}
                      placeholder="e.g. MIT Muzaffarpur"
                      className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm text-zinc-900 outline-none focus:border-emerald-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Subtitle / Tagline
                    </label>
                    <input
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="e.g. College Sports Tournament"
                      className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm text-zinc-900 outline-none focus:border-emerald-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Venue Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={venueName}
                      onChange={(e) => setVenueName(e.target.value)}
                      placeholder="e.g. Indoor Badminton Court"
                      className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm text-zinc-900 outline-none focus:border-emerald-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      City / Campus Address
                    </label>
                    <input
                      type="text"
                      value={venueAddress}
                      onChange={(e) => setVenueAddress(e.target.value)}
                      placeholder="e.g. Muzaffarpur, Bihar"
                      className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm text-zinc-900 outline-none focus:border-emerald-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Start Date
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm text-zinc-900 outline-none focus:border-emerald-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      End Date
                    </label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm text-zinc-900 outline-none focus:border-emerald-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-850 dark:bg-zinc-50 dark:text-zinc-950"
                >
                  Continue to Courts &amp; Format →
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Number of Courts Available
                  </label>
                  <select
                    value={courtCount}
                    onChange={(e) => setCourtCount(Number(e.target.value))}
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm text-zinc-900 outline-none focus:border-emerald-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    <option value={1}>1 Court</option>
                    <option value={2}>2 Courts (Recommended for standard championships)</option>
                    <option value={3}>3 Courts</option>
                    <option value={4}>4 Courts</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Tournament Visibility
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "PUBLIC", title: "Public", desc: "Searchable platform-wide" },
                      { id: "UNLISTED", title: "Unlisted", desc: "Direct link or QR only" },
                      { id: "PRIVATE", title: "Private", desc: "Organizer & Umpires only" },
                    ].map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVisibility(v.id as any)}
                        className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-colors ${
                          visibility === v.id
                            ? "border-emerald-600 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300"
                            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                        }`}
                      >
                        <span className="text-xs font-bold">{v.title}</span>
                        <span className="mt-1 text-[11px] text-zinc-500">{v.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                  <strong>Automatic Setup:</strong> Your tournament will automatically be provisioned with standard Men&apos;s Singles, Women&apos;s Singles, and Men&apos;s Doubles categories with BWF 21-point rules.
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex h-11 w-1/3 items-center justify-center rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-11 w-2/3 items-center justify-center rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-lg shadow-emerald-950 hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {loading ? "Creating Tournament..." : "Publish Tournament 🏸"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
