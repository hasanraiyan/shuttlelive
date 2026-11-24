"use client";

import Link from "next/link";
import { useAction } from "@/components/app/action-form";
import { EmptyState, Notice, Section, Select, StatusPill } from "@/components/app/ui";
import { assignCourt } from "@/lib/actions/setup";
import { REASON_LABEL, STATUS_LABEL, isActive, isDone, roundName } from "@/lib/scoring";
import type { Category, Court, MatchWithGames } from "@/lib/types";

type Props = {
  tid: string;
  matches: MatchWithGames[];
  courts: Court[];
  categories: Category[];
  names: Record<string, string>;
};

export function MatchesBoard({ tid, matches, courts, categories, names }: Props) {
  const catName = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const totalRounds: Record<string, number> = {};
  for (const m of matches) if (m.position !== null) totalRounds[m.category_id] = Math.max(totalRounds[m.category_id] ?? 0, m.round);

  const label = (m: MatchWithGames) =>
    `${catName[m.category_id]}${m.position !== null ? `, ${roundName(m.round, totalRounds[m.category_id] ?? m.round)}` : ""}`;

  const live = matches.filter(isActive);
  const ready = matches.filter((m) => m.status === "SCHEDULED" && m.entry_a_id && m.entry_b_id);
  const waiting = matches.filter((m) => m.status === "SCHEDULED" && (!m.entry_a_id || !m.entry_b_id));
  const done = matches.filter((m) => isDone(m) && m.result_reason !== "BYE").reverse();
  const busyCourts = new Set(live.map((m) => m.court_id).filter(Boolean));

  const versus = (m: MatchWithGames) => (
    <>
      {m.entry_a_id ? names[m.entry_a_id] : "To be decided"} <span className="text-ink-soft">v</span>{" "}
      {m.entry_b_id ? names[m.entry_b_id] : "To be decided"}
    </>
  );

  if (!matches.length) {
    return (
      <EmptyState title="No matches yet">
        Add players, create a category, then make the draw in{" "}
        <Link href={`/dashboard/t/${tid}/draws`} className="font-semibold text-ink underline underline-offset-4">
          Categories and draws
        </Link>
        .
      </EmptyState>
    );
  }

  return (
    <div className="space-y-10">
      <Section title="Courts">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {courts.map((c) => {
            const m = live.find((x) => x.court_id === c.id);
            return (
              <li key={c.id} className={`rounded-md border p-3 ${m ? "border-live" : "border-line"}`}>
                <p className="flex items-center justify-between text-sm font-semibold">
                  {c.name}
                  {m ? <StatusPill tone="live">In play</StatusPill> : <span className="font-normal text-ink-soft">Free</span>}
                </p>
                {m && (
                  <Link href={`/dashboard/t/${tid}/m/${m.id}`} className="mt-2 block text-sm hover:underline">
                    <span className="block truncate">{versus(m)}</span>
                    <span className="font-score text-2xl">{m.score_a}–{m.score_b}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      {live.length > 0 && (
        <Section title="In progress">
          <MatchList>
            {live.map((m) => (
              <Row key={m.id} title={versus(m)} meta={`${label(m)}, game ${m.current_game}, ${m.score_a}–${m.score_b}`}>
                <ScoreLink tid={tid} id={m.id} label="Continue scoring" primary />
              </Row>
            ))}
          </MatchList>
        </Section>
      )}

      <Section title="Ready to play" description="Pick a court, then open the match to start scoring on your phone.">
        {ready.length ? (
          <MatchList>
            {ready.map((m) => (
              <Row key={m.id} title={versus(m)} meta={label(m)}>
                <CourtPicker tid={tid} match={m} courts={courts} busy={busyCourts} />
                <ScoreLink tid={tid} id={m.id} label="Open" />
              </Row>
            ))}
          </MatchList>
        ) : (
          <p className="text-sm text-ink-soft">Nothing is waiting. New matches appear here when both players are known.</p>
        )}
      </Section>

      {waiting.length > 0 && (
        <Section title="Waiting for earlier results">
          <MatchList>
            {waiting.map((m) => (
              <Row key={m.id} title={versus(m)} meta={label(m)} />
            ))}
          </MatchList>
        </Section>
      )}

      {done.length > 0 && (
        <Section title="Finished">
          <MatchList>
            {done.map((m) => (
              <Row
                key={m.id}
                title={versus(m)}
                meta={`${label(m)}. ${m.winner_side ? `${names[(m.winner_side === "A" ? m.entry_a_id : m.entry_b_id) ?? ""]} won` : ""}${
                  m.result_reason && m.result_reason !== "NORMAL" ? ` (${REASON_LABEL[m.result_reason].toLowerCase()})` : ""
                }${m.games.length ? `, ${m.games.map((g) => `${g.score_a}–${g.score_b}`).join(", ")}` : ""}`}
              >
                <span className="text-sm text-ink-soft">{STATUS_LABEL[m.status]}</span>
              </Row>
            ))}
          </MatchList>
        </Section>
      )}
    </div>
  );
}

function MatchList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-line border-y border-line">{children}</ul>;
}

function Row({ title, meta, children }: { title: React.ReactNode; meta: string; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{title}</p>
        <p className="text-sm text-ink-soft">{meta}</p>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </li>
  );
}

function ScoreLink({ tid, id, label, primary }: { tid: string; id: string; label: string; primary?: boolean }) {
  return (
    <Link
      href={`/dashboard/t/${tid}/m/${id}`}
      className={
        primary
          ? "inline-flex h-9 items-center rounded-md bg-court px-3 text-sm font-semibold text-court-line hover:bg-court-deep"
          : "inline-flex h-9 items-center rounded-md border border-line px-3 text-sm font-semibold hover:border-ink"
      }
    >
      {label}
    </Link>
  );
}

function CourtPicker({ tid, match, courts, busy }: { tid: string; match: MatchWithGames; courts: Court[]; busy: Set<string | null> }) {
  const { pending, error, run } = useAction();
  return (
    <div>
      <Select
        aria-label="Court"
        className="h-9 w-36"
        disabled={pending}
        value={match.court_id ?? ""}
        onChange={(e) => run(() => assignCourt(tid, match.id, e.target.value || null))}
      >
        <option value="">No court</option>
        {courts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {busy.has(c.id) ? " (in play)" : ""}
          </option>
        ))}
      </Select>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
