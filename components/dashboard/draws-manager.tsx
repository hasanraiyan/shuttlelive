"use client";

import * as React from "react";
import { ActionForm, useAction } from "@/components/app/action-form";
import { Button, EmptyState, Input, Label, Notice, Section, Select } from "@/components/app/ui";
import { Bracket } from "@/components/tournament/bracket";
import {
  addCategory,
  addEntry,
  addFixture,
  clearDraw,
  deleteCategory,
  deleteEntry,
  deleteFixture,
  generateDraw,
} from "@/lib/actions/setup";
import { PRESETS, STATUS_LABEL } from "@/lib/scoring";
import type { Category, Court, Entry, MatchWithGames, Player, RulePreset } from "@/lib/types";

type Props = {
  tid: string;
  categories: Category[];
  players: Player[];
  entries: Entry[];
  matches: MatchWithGames[];
  courts: Court[];
};

export function DrawsManager(props: Props) {
  const { tid, categories } = props;
  const [openId, setOpenId] = React.useState<string | null>(categories[0]?.id ?? null);
  const open = categories.find((c) => c.id === openId) ?? categories[0];

  return (
    <div className="grid gap-10 lg:grid-cols-[18rem_1fr] lg:items-start">
      <div className="space-y-8">
        <Section title="Categories">
          {categories.length === 0 ? (
            <p className="text-sm text-ink-soft">Add a category such as men&apos;s singles to start entering players.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {categories.map((c) => {
                const n = props.entries.filter((e) => e.category_id === c.id).length;
                const selected = c.id === open?.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(c.id)}
                      aria-current={selected ? "true" : undefined}
                      className={`flex w-full items-center justify-between gap-2 px-2 py-2.5 text-left ${selected ? "bg-surface-2 font-semibold" : "hover:bg-surface-2"}`}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="shrink-0 text-sm text-ink-soft">{n} entr{n === 1 ? "y" : "ies"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Add a category">
          <ActionForm action={addCategory.bind(null, tid)} resetOnSuccess className="grid gap-3">
            {(pending) => (
              <>
                <div>
                  <Label htmlFor="cat-name">Name</Label>
                  <Input id="cat-name" name="name" required minLength={2} maxLength={60} placeholder="Men's singles" />
                </div>
                <div>
                  <Label htmlFor="cat-kind">Format</Label>
                  <Select id="cat-kind" name="kind" defaultValue="SINGLES">
                    <option value="SINGLES">Singles</option>
                    <option value="DOUBLES">Doubles</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="cat-rules">Scoring</Label>
                  <Select id="cat-rules" name="rule_preset" defaultValue="BWF_21">
                    {(Object.keys(PRESETS) as RulePreset[]).map((k) => (
                      <option key={k} value={k}>
                        {PRESETS[k].label}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" disabled={pending}>
                  {pending ? "Adding…" : "Add category"}
                </Button>
              </>
            )}
          </ActionForm>
        </Section>
      </div>

      {open ? <CategoryPanel key={open.id} category={open} {...props} /> : (
        <EmptyState title="No categories yet">Add one on the left.</EmptyState>
      )}
    </div>
  );
}

function CategoryPanel({ tid, category: c, players, entries, matches, courts }: Props & { category: Category }) {
  const catEntries = entries.filter((e) => e.category_id === c.id);
  const catMatches = matches.filter((m) => m.category_id === c.id);
  const drawn = catMatches.filter((m) => m.position !== null);
  const fixtures = catMatches.filter((m) => m.position === null);
  const names = Object.fromEntries(catEntries.map((e) => [e.id, e.display_name]));
  const entered = new Set(catEntries.flatMap((e) => [e.player1_id, e.player2_id]).filter(Boolean) as string[]);
  const available = players.filter((p) => !entered.has(p.id));
  const played = drawn.some((m) => m.status !== "SCHEDULED" && m.result_reason !== "BYE");
  const { pending, error, run } = useAction();

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-4xl">{c.name}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {c.kind === "SINGLES" ? "Singles" : "Doubles"}, {PRESETS[c.rule_preset].label.toLowerCase()}.{" "}
            {PRESETS[c.rule_preset].detail}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending || played}
          onClick={() => run(() => deleteCategory(tid, c.id), `Delete ${c.name} with its entries and draw?`)}
        >
          Delete category
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}

      <Section title={`Entries (${catEntries.length})`} description="Seeds are optional. Seeded entries are kept apart in the draw, and top seeds get any byes.">
        {catEntries.length > 0 && (
          <ul className="mb-5 divide-y divide-line border-y border-line">
            {catEntries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                <span className="truncate">
                  {e.seed && <span className="mr-2 text-sm font-semibold text-court">Seed {e.seed}</span>}
                  {e.display_name}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => deleteEntry(tid, e.id), `Remove ${e.display_name} from ${c.name}?`)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        {players.length === 0 ? (
          <Notice tone="info">Add players in the Players tab first.</Notice>
        ) : available.length < (c.kind === "DOUBLES" ? 2 : 1) ? (
          <Notice tone="info">Every player is already entered in this category.</Notice>
        ) : (
          <ActionForm action={addEntry.bind(null, tid)} resetOnSuccess className="flex flex-wrap items-end gap-3">
            {(p) => (
              <>
                <input type="hidden" name="category_id" value={c.id} />
                <div className="min-w-48 flex-1">
                  <Label htmlFor="p1">{c.kind === "DOUBLES" ? "First player" : "Player"}</Label>
                  <PlayerSelect id="p1" name="player1_id" players={available} />
                </div>
                {c.kind === "DOUBLES" && (
                  <div className="min-w-48 flex-1">
                    <Label htmlFor="p2">Partner</Label>
                    <PlayerSelect id="p2" name="player2_id" players={available} />
                  </div>
                )}
                <div className="w-24">
                  <Label htmlFor="seed" hint="optional">Seed</Label>
                  <Input id="seed" name="seed" type="number" min={1} max={128} />
                </div>
                <Button type="submit" disabled={p}>Add entry</Button>
              </>
            )}
          </ActionForm>
        )}
      </Section>

      <Section
        title="Knockout draw"
        description={
          drawn.length
            ? "Winners move to the next round automatically when a result is confirmed."
            : "Make the draw once entries are in. Byes are worked out for you."
        }
        action={
          <div className="flex gap-2">
            {drawn.length > 0 && !played && (
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => clearDraw(tid, c.id), "Remove this draw?")}>
                Remove draw
              </Button>
            )}
            {!played && (
              <Button
                size="sm"
                disabled={pending || catEntries.length < 2}
                onClick={() =>
                  run(
                    () => generateDraw(tid, c.id),
                    drawn.length ? "Make a new draw? The current one is replaced." : undefined
                  )
                }
              >
                {drawn.length ? "Make a new draw" : "Make the draw"}
              </Button>
            )}
          </div>
        }
      >
        {drawn.length ? (
          <Bracket matches={drawn} names={names} hrefFor={(m) => (m.entry_a_id && m.entry_b_id && m.result_reason !== "BYE" ? `/dashboard/t/${tid}/m/${m.id}` : null)} />
        ) : (
          <EmptyState title="No draw yet">
            {catEntries.length < 2 ? "Add at least two entries first." : `Ready to draw ${catEntries.length} entries.`}
          </EmptyState>
        )}
      </Section>

      <Section title="Other matches" description="For a draw you made on paper, or friendly and group matches outside the bracket.">
        {fixtures.length > 0 && (
          <ul className="mb-5 divide-y divide-line border-y border-line">
            {fixtures.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="truncate">
                  {names[m.entry_a_id ?? ""] ?? "?"} <span className="text-ink-soft">v</span> {names[m.entry_b_id ?? ""] ?? "?"}
                </span>
                <span className="flex items-center gap-2 text-sm text-ink-soft">
                  {STATUS_LABEL[m.status]}
                  {m.status === "SCHEDULED" && (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => deleteFixture(tid, m.id), "Remove this match?")}>
                      Remove
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {catEntries.length >= 2 ? (
          <ActionForm action={addFixture.bind(null, tid)} resetOnSuccess className="flex flex-wrap items-end gap-3">
            {(p) => (
              <>
                <input type="hidden" name="category_id" value={c.id} />
                <div className="min-w-44 flex-1">
                  <Label htmlFor="ea">Side A</Label>
                  <Select id="ea" name="entry_a_id" required defaultValue="">
                    <option value="" disabled>Choose</option>
                    {catEntries.map((e) => <option key={e.id} value={e.id}>{e.display_name}</option>)}
                  </Select>
                </div>
                <div className="min-w-44 flex-1">
                  <Label htmlFor="eb">Side B</Label>
                  <Select id="eb" name="entry_b_id" required defaultValue="">
                    <option value="" disabled>Choose</option>
                    {catEntries.map((e) => <option key={e.id} value={e.id}>{e.display_name}</option>)}
                  </Select>
                </div>
                <div className="w-36">
                  <Label htmlFor="court">Court</Label>
                  <Select id="court" name="court_id" defaultValue="">
                    <option value="">Not set</option>
                    {courts.map((ct) => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                  </Select>
                </div>
                <Button type="submit" variant="secondary" disabled={p}>Add match</Button>
              </>
            )}
          </ActionForm>
        ) : (
          <p className="text-sm text-ink-soft">Add at least two entries to create a match.</p>
        )}
      </Section>
    </div>
  );
}

function PlayerSelect({ id, name, players }: { id: string; name: string; players: Player[] }) {
  return (
    <Select id={id} name={name} required defaultValue="">
      <option value="" disabled>
        Choose a player
      </option>
      {players.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
          {p.club ? ` (${p.club})` : ""}
        </option>
      ))}
    </Select>
  );
}
