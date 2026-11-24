"use client";

import * as React from "react";
import { useAction } from "@/components/app/action-form";
import { Button, EmptyState, Input, Notice, Section } from "@/components/app/ui";
import { addPlayerRows, deletePlayer, updatePlayer } from "@/lib/actions/setup";
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
    <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start">
      <Section title="Add players" description="Club is optional. Press Enter to move to the next row.">
        <AddPlayersTable tid={tid} players={players} />
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
          {[player.club, entries > 0 && `In ${entries} categor${entries === 1 ? "y" : "ies"}`].filter(Boolean).join(", ") ||
            "Not entered yet"}
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

type Row = { key: string; name: string; club: string };
const newRow = (): Row => ({ key: crypto.randomUUID(), name: "", club: "" });
const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** Spreadsheet-style table for adding players: one row per player, name plus optional club. */
function AddPlayersTable({ tid, players }: { tid: string; players: Player[] }) {
  const [rows, setRows] = React.useState<Row[]>(() => [newRow(), newRow(), newRow()]);
  const [message, setMessage] = React.useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = React.useTransition();
  const focusKey = React.useRef<{ key: string; field: "name" | "club" } | null>(null);
  const inputs = React.useRef(new Map<string, HTMLInputElement>());

  // Move focus after rows change (row added or removed).
  React.useEffect(() => {
    const f = focusKey.current;
    if (!f) return;
    inputs.current.get(`${f.key}:${f.field}`)?.focus();
    focusKey.current = null;
  }, [rows]);

  const existing = React.useMemo(() => new Set(players.map((p) => norm(p.name))), [players]);
  const clubs = React.useMemo(
    () => [...new Set(players.map((p) => p.club).filter(Boolean) as string[])].sort(),
    [players]
  );
  const filled = rows.filter((r) => r.name.trim());
  const counts = new Map<string, number>();
  for (const r of filled) counts.set(norm(r.name), (counts.get(norm(r.name)) ?? 0) + 1);

  const update = (key: string, field: "name" | "club", value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const addAfter = (index: number) => {
    const row = newRow();
    focusKey.current = { key: row.key, field: "name" };
    setRows((rs) => [...rs.slice(0, index + 1), row, ...rs.slice(index + 1)]);
  };

  const remove = (index: number) =>
    setRows((rs) => {
      if (rs.length === 1) return [newRow()];
      focusKey.current = { key: rs[Math.max(0, index - 1)].key, field: "name" };
      return rs.filter((_, i) => i !== index);
    });

  const nextRow = (i: number) => {
    if (i === rows.length - 1) addAfter(i);
    else inputs.current.get(`${rows[i + 1].key}:name`)?.focus();
  };

  // Pasting several lines ("Name, Club" or tab-separated from a spreadsheet) fills one row per line.
  const onPaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!/\r?\n/.test(text.trim())) return;
    e.preventDefault();
    const pasted: Row[] = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 200)
      .map((line) => {
        const [name, ...rest] = line.split(/\t|,/);
        return { key: crypto.randomUUID(), name: name.trim().slice(0, 80), club: rest.join(" ").trim().slice(0, 80) };
      });
    setRows((rs) => {
      const before = rs.slice(0, index);
      const after = rs.slice(index + 1).filter((r) => r.name || r.club);
      return [...before, ...pasted, ...after, newRow()];
    });
  };

  const submit = () => {
    setMessage(null);
    const payload = filled.map((r) => ({ name: r.name.trim(), club: r.club.trim() || undefined }));
    if (!payload.length) {
      setMessage({ tone: "error", text: "Type at least one player name." });
      return;
    }
    start(async () => {
      const res = await addPlayerRows(tid, payload);
      if (res.ok) {
        const fresh = [newRow(), newRow(), newRow()];
        focusKey.current = { key: fresh[0].key, field: "name" };
        setRows(fresh);
        setMessage({ tone: "success", text: res.message ?? "Players added." });
      } else {
        setMessage({ tone: "error", text: res.error });
      }
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="text-left text-ink-soft">
            <th scope="col" className="w-[55%] pb-1.5 font-semibold">
              Name
            </th>
            <th scope="col" className="pb-1.5 pl-2 font-semibold">
              Club
            </th>
            <th scope="col" className="w-11 pb-1.5">
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const n = norm(r.name);
            const warning = !n
              ? null
              : existing.has(n)
                ? "Already in this tournament"
                : (counts.get(n) ?? 0) > 1
                  ? "Listed twice"
                  : null;
            return (
              <React.Fragment key={r.key}>
                <tr>
                  <td className="py-1 align-top">
                    <Input
                      ref={(el) => {
                        if (el) inputs.current.set(`${r.key}:name`, el);
                        else inputs.current.delete(`${r.key}:name`);
                      }}
                      aria-label={`Player ${i + 1} name`}
                      aria-invalid={warning ? true : undefined}
                      value={r.name}
                      maxLength={80}
                      placeholder={i === 0 ? "Aman Kumar" : ""}
                      onChange={(e) => update(r.key, "name", e.target.value)}
                      onPaste={(e) => onPaste(i, e)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          nextRow(i);
                        } else if (e.key === "Backspace" && !r.name && !r.club && rows.length > 1) {
                          e.preventDefault();
                          remove(i);
                        }
                      }}
                      className={warning ? "border-warn" : undefined}
                    />
                  </td>
                  <td className="py-1 pl-2 align-top">
                    <Input
                      ref={(el) => {
                        if (el) inputs.current.set(`${r.key}:club`, el);
                        else inputs.current.delete(`${r.key}:club`);
                      }}
                      aria-label={`Player ${i + 1} club`}
                      list="club-suggestions"
                      value={r.club}
                      maxLength={80}
                      placeholder={i === 0 ? "Optional" : ""}
                      onChange={(e) => update(r.key, "club", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          nextRow(i);
                        }
                      }}
                    />
                  </td>
                  <td className="py-1 pl-1 align-top">
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      aria-label={`Remove row ${i + 1}`}
                      className="flex size-10 items-center justify-center rounded-md text-lg text-ink-soft hover:bg-surface-2 hover:text-fault"
                    >
                      ×
                    </button>
                  </td>
                </tr>
                {warning && (
                  <tr>
                    <td colSpan={3} className="pb-1 text-xs font-semibold text-ink">
                      <span className="mr-1.5 inline-block size-1.5 rounded-full bg-warn align-middle" aria-hidden="true" />
                      {warning}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <datalist id="club-suggestions">
        {clubs.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <button
        type="button"
        onClick={() => addAfter(rows.length - 1)}
        className="mt-2 w-full rounded-md border border-dashed border-line py-2 text-sm font-semibold text-ink-soft hover:border-court hover:text-court"
      >
        + Add player
      </button>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !filled.length}>
          {pending ? "Adding…" : filled.length > 1 ? `Add ${filled.length} players` : "Add player"}
        </Button>
        <span className="text-xs text-ink-soft">Tip: paste a list of names to fill several rows at once.</span>
      </div>
      {message && (
        <div className="mt-3">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
    </form>
  );
}
