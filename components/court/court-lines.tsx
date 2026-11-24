import { cn } from "@/lib/utils";

/* A badminton court drawn to BWF proportions, in decimetres:
   13.4 m × 6.1 m, short service line 1.98 m from the net,
   doubles long service line 0.76 m from the back, singles alley 0.46 m. */
const L = 134;
const W = 61;
const NET = L / 2;
const SHORT = 19.8;
const LONG = 7.6;
const ALLEY = 4.6;
const MID = W / 2;
const STROKE = 0.5;

type Props = {
  orientation?: "horizontal" | "vertical";
  className?: string;
  /** Show the net as a heavier line across the middle. */
  net?: boolean;
};

export function CourtLines({ orientation = "horizontal", className, net = true }: Props) {
  const vertical = orientation === "vertical";
  return (
    <svg
      viewBox={vertical ? `0 0 ${W} ${L}` : `0 0 ${L} ${W}`}
      className={cn("block text-court-line", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform={vertical ? `translate(${W},0) rotate(90)` : undefined}>
        <rect x={STROKE / 2} y={STROKE / 2} width={L - STROKE} height={W - STROKE} />
        <line x1={0} x2={L} y1={ALLEY} y2={ALLEY} />
        <line x1={0} x2={L} y1={W - ALLEY} y2={W - ALLEY} />
        <line x1={LONG} x2={LONG} y1={0} y2={W} />
        <line x1={L - LONG} x2={L - LONG} y1={0} y2={W} />
        <line x1={NET - SHORT} x2={NET - SHORT} y1={0} y2={W} />
        <line x1={NET + SHORT} x2={NET + SHORT} y1={0} y2={W} />
        <line x1={0} x2={NET - SHORT} y1={MID} y2={MID} />
        <line x1={NET + SHORT} x2={L} y1={MID} y2={MID} />
        {net && (
          <line
            x1={NET}
            x2={NET}
            y1={-2}
            y2={W + 2}
            strokeWidth={STROKE * 2.4}
            strokeDasharray="0.6 0.6"
          />
        )}
      </g>
    </svg>
  );
}

/** Geometry for placing things on a horizontal court, as CSS percentages. */
export const COURT = {
  /** The singles service box a server stands in. */
  serviceBox(side: "left" | "right", box: "top" | "bottom") {
    const depth = NET - SHORT;
    const x = side === "left" ? 0 : NET + SHORT;
    const y = box === "top" ? ALLEY : MID;
    return {
      left: `${(x / L) * 100}%`,
      width: `${(depth / L) * 100}%`,
      top: `${(y / W) * 100}%`,
      height: `${((MID - ALLEY) / W) * 100}%`,
    };
  },
  aspect: `${L} / ${W}`,
  aspectVertical: `${W} / ${L}`,
};
