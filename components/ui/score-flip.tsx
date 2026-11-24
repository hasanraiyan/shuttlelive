"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: number | string;
  className?: string;
  /** Minimum number of character slots (e.g. 2 for " 6" or "06"). Default 0. */
  minDigits?: number;
  /** Optional accessible prefix for screen readers */
  label?: string;
};

/**
 * Animated scoreboard numeral that rolls up on point increment (+1)
 * and rolls down on undo (-1) with zero layout shift and full accessibility.
 */
export function ScoreFlip({ value, className, minDigits = 0, label }: Props) {
  const [current, setCurrent] = React.useState(value);
  const [prev, setPrev] = React.useState(value);
  const [animating, setAnimating] = React.useState(false);
  const [direction, setDirection] = React.useState<"up" | "down">("up");

  React.useEffect(() => {
    if (value !== current) {
      const numCurr = Number(value);
      const numPrev = Number(current);
      const isDown = !isNaN(numCurr) && !isNaN(numPrev) && numCurr < numPrev;

      setDirection(isDown ? "down" : "up");
      setPrev(current);
      setCurrent(value);
      setAnimating(true);

      const timer = setTimeout(() => {
        setAnimating(false);
      }, 320);

      return () => clearTimeout(timer);
    }
  }, [value, current]);

  const currStr = String(current);
  const prevStr = String(prev);
  const maxLen = Math.max(currStr.length, prevStr.length, minDigits);

  const currPadded = currStr.padStart(maxLen, " ");
  const prevPadded = prevStr.padStart(maxLen, " ");

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-end font-score tabular-nums leading-none select-none",
        animating && "transition-transform duration-200 ease-out",
        className
      )}
      aria-label={label ? `${label}: ${value}` : String(value)}
    >
      <span className="sr-only">{value}</span>

      {/* Visual rolling digit columns */}
      <span aria-hidden="true" className="inline-flex items-baseline overflow-hidden">
        {currPadded.split("").map((cCurr, idx) => {
          const cPrev = prevPadded[idx] ?? " ";
          return (
            <FlipColumn
              key={idx}
              current={cCurr}
              previous={cPrev}
              animating={animating}
              direction={direction}
            />
          );
        })}
      </span>
    </span>
  );
}

function FlipColumn({
  current,
  previous,
  animating,
  direction,
}: {
  current: string;
  previous: string;
  animating: boolean;
  direction: "up" | "down";
}) {
  const changed = current !== previous;
  const isUp = direction === "up";

  // Display characters: space becomes non-breaking space for layout width
  const dispCurrent = current === " " ? "\u00A0" : current;
  const dispPrevious = previous === " " ? "\u00A0" : previous;

  if (!changed || !animating) {
    return (
      <span className="relative inline-block overflow-hidden">
        <span className="inline-block leading-none">{dispCurrent}</span>
      </span>
    );
  }

  return (
    <span className="relative inline-block overflow-hidden leading-none">
      {/* Sizer: invisible placeholder that guarantees stable width and height */}
      <span className="invisible inline-block leading-none">{dispCurrent}</span>

      {/* Exiting previous digit */}
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center leading-none",
          "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "motion-reduce:transition-none motion-reduce:transform-none",
          isUp ? "-translate-y-full opacity-0" : "translate-y-full opacity-0"
        )}
      >
        {dispPrevious}
      </span>

      {/* Entering current digit */}
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center leading-none",
          "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "motion-reduce:transition-none motion-reduce:transform-none",
          "translate-y-0 opacity-100"
        )}
        style={{
          animation: isUp
            ? "scoreRollInUp 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards"
            : "scoreRollInDown 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {dispCurrent}
      </span>
    </span>
  );
}
