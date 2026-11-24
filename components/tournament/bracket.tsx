import Link from "next/link";
import { REASON_LABEL, isActive, roundName } from "@/lib/scoring";
import type { MatchWithGames, Side } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  matches: MatchWithGames[];
  names: Record<string, string>;
  hrefFor?: (m: MatchWithGames) => string | null;
};

/** Knockout bracket: one column per round, drawn from the matches' round/position. */
export function Bracket({ matches, names, hrefFor }: Props) {
  const drawn = matches.filter((m) => m.position !== null);
  if (!drawn.length) return null;
  const rounds = Math.max(...drawn.map((m) => m.round));
  const columns = Array.from({ length: rounds }, (_, i) =>
    drawn.filter((m) => m.round === i + 1).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  );

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-6">
        {columns.map((col, i) => (
          <div key={i} className="flex w-56 flex-col">
            <p className="mb-3 text-sm font-semibold text-ink-soft">{roundName(i + 1, rounds)}</p>
            <ol className="flex flex-1 flex-col justify-around gap-3">
              {col.map((m) => (
                <li key={m.id}>
                  <BracketMatch match={m} names={names} href={hrefFor?.(m) ?? null} />
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketMatch({ match: m, names, href }: { match: MatchWithGames; names: Record<string, string>; href: string | null }) {
  const live = isActive(m);
  const body = (
    <div
      className={cn(
        "rounded-md border bg-surface text-sm",
        live ? "border-live" : "border-line",
        href && "hover:border-ink"
      )}
    >
      <Row match={m} side="A" name={m.entry_a_id ? names[m.entry_a_id] : null} />
      <div className="border-t border-line" />
      <Row match={m} side="B" name={m.entry_b_id ? names[m.entry_b_id] : null} />
      {(live || (m.result_reason && m.result_reason !== "NORMAL")) && (
        <p className="border-t border-line px-2.5 py-1 text-xs text-ink-soft">
          {live ? "In progress" : REASON_LABEL[m.result_reason!]}
        </p>
      )}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

function Row({ match: m, side, name }: { match: MatchWithGames; side: Side; name: string | null }) {
  const won = m.winner_side === side && (m.status === "FINALIZED" || m.status === "TERMINATED");
  const scores = m.games.map((g) => (side === "A" ? g.score_a : g.score_b));
  const isBye = m.result_reason === "BYE" && !name;
  return (
    <div className={cn("flex items-center justify-between gap-2 px-2.5 py-1.5", won && "font-semibold")}>
      <span className={cn("truncate", !name && "text-ink-soft")}>{name ?? (isBye ? "Bye" : "To be decided")}</span>
      {scores.length > 0 && (
        <span className="font-score flex shrink-0 gap-1.5 text-base tabular-nums">
          {scores.map((s, i) => (
            <span key={i}>{s}</span>
          ))}
        </span>
      )}
    </div>
  );
}
