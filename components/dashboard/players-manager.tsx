"use client";

import * as React from "react";
import { ActionForm, useAction } from "@/components/app/action-form";
import { Button, EmptyState, Input, Label, Notice, Section, Textarea } from "@/components/app/ui";
import { addPlayers, deletePlayer, updatePlayer } from "@/lib/actions/setup";
import type { Player } from "@/lib/types";

export function PlayersManager({
  tid,
  players,
  entryCount,
}: {
  tid: string;
  players: Player[];
  entryCount: Record<string, number>;
}) {
  const [query, setQuery] = React.useState("");
  const shown = players.filter((p) =>
    `${p.name} ${p.club ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[22rem_1fr] lg:items-start">
      <Section title="Add players" description="One player per line. Add a comma and a club name if you want it shown.">
        <ActionForm action={addPlayers.bind(null, tid)} resetOnSuccess>
          {(pending) => (
            <>
              <Label htmlFor="players">Players</Label>
              <Textarea
                id="players"
                name="players"
                rows={8}
                required
                placeholder={"Aman Kumar, Smash Academy\nRahul Sharma\nPriya Singh, Riverside BC"}
              />
              <Button type="submit" className="mt-3" disabled={pending}>
                {pending ? "Adding…" : "Add players"}
              </Button>
            </>
          )}
        </ActionForm>
      </Section>

      <Section
        title={`${players.length} player${players.length === 1 ? "" : "s"}`}
        action={
          players.length > 8 ? (
            <Input
              aria-label="Search players"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-48"
            />
          ) : undefined
        }
      >
        {players.length === 0 ? (
          <EmptyState title="No players yet">Add the names on the left, then enter them into categories.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {shown.map((p) => (
              <PlayerRow key={p.id} tid={tid} player={p} entries={entryCount[p.id] ?? 0} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function PlayerRow({ tid, player, entries }: { tid: string; player: Player; entries: number }) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(player.name);
  const [club, setClub] = React.useState(player.club ?? "");
  const { pending, error, run } = useAction();

  if (editing) {
    return (
      <li className="py-3">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const res = await updatePlayer(tid, player.id, { name, club });
              if (res.ok) setEditing(false);
              return res;
            });
          }}
        >
          <Input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className="w-52" />
          <Input aria-label="Club" value={club} onChange={(e) => setClub(e.target.value)} maxLength={80} placeholder="Club" className="w-44" />
          <Button size="sm" type="submit" disabled={pending}>Save</Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>Cancel</Button>
        </form>
        {error && <div className="mt-2"><Notice tone="error">{error}</Notice></div>}
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <div className="min-w-0">
        <p className="truncate font-medium">{player.name}</p>
        <p className="text-sm text-ink-soft">
          {player.club ?? "No club"}
          {entries > 0 && `, in ${entries} categor${entries === 1 ? "y" : "ies"}`}
        </p>
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            run(
              () => deletePlayer(tid, player.id),
              entries > 0
                ? `Remove ${player.name}? Their category entries are removed too.`
                : `Remove ${player.name}?`
            )
          }
        >
          Remove
        </Button>
      </div>
      {error && <div className="w-full"><Notice tone="error">{error}</Notice></div>}
    </li>
  );
}
