"use client";

import * as React from "react";
import type { Rally } from "@/lib/match-stats";
import type { Side } from "@/lib/types";

/**
 * "Worm" chart for one game: the lead after every rally. Above the baseline
 * side A leads (side-a colour), below it side B leads (side-b colour).
 * Identity never relies on colour alone: a legend, direct "ahead" labels,
 * a hover/keyboard readout and a table view all name the players.
 */
export function LeadChart({ game, rallies, names }: { game: number; rallies: Rally[]; names: Record<Side, string> }) {
  const id = React.useId();
  const [active, setActive] = React.useState<number | null>(null);
  const W = 600;
  const H = 160;
  const pad = { l: 8, r: 8, t: 14, b: 14 };

  const pts = [{ n: 0, lead: 0, a: 0, b: 0 }, ...rallies.map((r) => ({ n: r.n, lead: r.a - r.b, a: r.a, b: r.b }))];
  const maxN = Math.max(pts.at(-1)!.n, 10);
  const maxLead = Math.max(3, ...pts.map((p) => Math.abs(p.lead)));
  const x = (n: number) => pad.l + (n / maxN) * (W - pad.l - pad.r);
  const y = (lead: number) => pad.t + ((maxLead - lead) / (2 * maxLead)) * (H - pad.t - pad.b);
  const zero = y(0);

  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.n).toFixed(1)},${y(p.lead).toFixed(1)}`).join("");
  const area = `${line}L${x(pts.at(-1)!.n).toFixed(1)},${zero}L${x(0)},${zero}Z`;
  const cur = active !== null ? pts[active] : null;

  const pick = (clientX: number, el: SVGSVGElement) => {
    const box = el.getBoundingClientRect();
    const n = ((clientX - box.left) / box.width) * W;
    const rally = Math.round(((n - pad.l) / (W - pad.l - pad.r)) * maxN);
    setActive(Math.min(pts.length - 1, Math.max(0, rally)));
  };

  const readout = cur
    ? cur.n === 0
      ? "Start of the game, 0–0"
      : `After rally ${cur.n}: ${names.A} ${cur.a}, ${names.B} ${cur.b}${
          cur.lead === 0 ? ", level" : `, ${cur.lead > 0 ? names.A : names.B} ahead by ${Math.abs(cur.lead)}`
        }`
    : null;

  return (
    <figure>
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">Game {game}</span>
        <span className="text-ink-soft" aria-live="polite">
          {readout ?? "Hover or use the arrow keys to see the score"}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-none rounded-md bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-court"
        role="img"
        aria-label={`Lead over time in game ${game}. Above the line ${names.A} leads, below it ${names.B} leads.`}
        tabIndex={0}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
        onPointerLeave={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            setActive((i) => {
              const start = i ?? (e.key === "ArrowRight" ? -1 : pts.length);
              return Math.min(pts.length - 1, Math.max(0, start + (e.key === "ArrowRight" ? 1 : -1)));
            });
          }
        }}
        onBlur={() => setActive(null)}
      >
        <defs>
          <clipPath id={`${id}-top`}>
            <rect x="0" y="0" width={W} height={zero} />
          </clipPath>
          <clipPath id={`${id}-bottom`}>
            <rect x="0" y={zero} width={W} height={H - zero} />
          </clipPath>
        </defs>
        <path d={area} clipPath={`url(#${id}-top)`} className="fill-side-a" fillOpacity={0.22} />
        <path d={area} clipPath={`url(#${id}-bottom)`} className="fill-side-b" fillOpacity={0.22} />
        <line x1={pad.l} x2={W - pad.r} y1={zero} y2={zero} className="stroke-ink-soft" strokeWidth={1} strokeDasharray="3 3" />
        <path d={line} fill="none" className="stroke-ink" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <text x={pad.l + 4} y={pad.t + 10} className="fill-ink-soft text-[11px]">
          {names.A} ahead
        </text>
        <text x={pad.l + 4} y={H - pad.b - 2} className="fill-ink-soft text-[11px]">
          {names.B} ahead
        </text>
        {cur && (
          <>
            <line x1={x(cur.n)} x2={x(cur.n)} y1={pad.t} y2={H - pad.b} className="stroke-ink-soft" strokeWidth={1} />
            <circle cx={x(cur.n)} cy={y(cur.lead)} r={5} className="fill-ink stroke-surface-2" strokeWidth={2} />
          </>
        )}
      </svg>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-ink-soft hover:text-ink">Show as table</summary>
        <div className="mt-2 max-h-60 overflow-y-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="text-ink-soft">
              <tr>
                <th scope="col" className="py-1 font-semibold">Rally</th>
                <th scope="col" className="py-1 font-semibold">{names.A}</th>
                <th scope="col" className="py-1 font-semibold">{names.B}</th>
                <th scope="col" className="py-1 font-semibold">Lead</th>
              </tr>
            </thead>
            <tbody>
              {pts.slice(1).map((p) => (
                <tr key={p.n} className="border-t border-line">
                  <td className="py-1">{p.n}</td>
                  <td className="py-1">{p.a}</td>
                  <td className="py-1">{p.b}</td>
                  <td className="py-1">{p.lead === 0 ? "Level" : `${p.lead > 0 ? names.A : names.B} +${Math.abs(p.lead)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Legend for the lead charts (two series, always shown). */
export function SidesLegend({ names }: { names: Record<Side, string> }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
      {(["A", "B"] as Side[]).map((s) => (
        <li key={s} className="flex items-center gap-2">
          <span className={s === "A" ? "size-3 rounded-sm bg-side-a" : "size-3 rounded-sm bg-side-b"} aria-hidden="true" />
          {names[s]} ahead
        </li>
      ))}
    </ul>
  );
}
