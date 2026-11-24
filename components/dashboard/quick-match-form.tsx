"use client";

import * as React from "react";
import { ActionForm } from "@/components/app/action-form";
import { Button, Input, Label, Select } from "@/components/app/ui";
import { createQuickMatch } from "@/lib/actions/quick";
import { PRESETS } from "@/lib/scoring";
import type { RulePreset } from "@/lib/types";
import { cn } from "@/lib/utils";

export function QuickMatchForm() {
  const [kind, setKind] = React.useState<"SINGLES" | "DOUBLES">("SINGLES");
  const doubles = kind === "DOUBLES";
  return (
    <ActionForm action={createQuickMatch} className="grid max-w-xl gap-6">
      {(pending) => (
        <>
          <input type="hidden" name="kind" value={kind} />
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">Match type</legend>
            <div className="inline-grid grid-cols-2 rounded-md bg-surface-2 p-1">
              {(["SINGLES", "DOUBLES"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "rounded px-5 py-2 text-sm font-semibold",
                    kind === k ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
                  )}
                >
                  {k === "SINGLES" ? "Singles" : "Doubles"}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-6 sm:grid-cols-2">
            {(["a", "b"] as const).map((side) => (
              <fieldset key={side} className="rounded-md border border-line p-4">
                <legend className="px-1 text-sm font-semibold">{side === "a" ? "Side A" : "Side B"}</legend>
                <div className="grid gap-3">
                  <div>
                    <Label htmlFor={`${side}1`}>{doubles ? "Player 1" : "Player"}</Label>
                    <Input id={`${side}1`} name={`${side}1`} required maxLength={80} autoComplete="off" />
                  </div>
                  {doubles && (
                    <div>
                      <Label htmlFor={`${side}2`}>Player 2</Label>
                      <Input id={`${side}2`} name={`${side}2`} required maxLength={80} autoComplete="off" />
                    </div>
                  )}
                </div>
              </fieldset>
            ))}
          </div>

          <div>
            <Label htmlFor="preset">Scoring</Label>
            <Select id="preset" name="preset" defaultValue="BWF_21">
              {(Object.keys(PRESETS) as RulePreset[]).map((k) => (
                <option key={k} value={k}>
                  {PRESETS[k].label}
                </option>
              ))}
            </Select>
          </div>

          <p className="text-sm text-ink-soft">
            The match gets its own live page with commentary. Only people you send the link to can find it.
          </p>
          <div>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Setting up…" : "Start scoring"}
            </Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
