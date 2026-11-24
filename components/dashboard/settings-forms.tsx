"use client";

import * as React from "react";
import { ActionForm, useAction } from "@/components/app/action-form";
import { Button, Input, Label, Notice, Section, Select, Textarea } from "@/components/app/ui";
import { addCourt, deleteCourt } from "@/lib/actions/setup";
import {
  deleteTournament,
  setTournamentImage,
  updateSlug,
  updateTournamentDetails,
} from "@/lib/actions/tournaments";
import { createClient } from "@/lib/supabase/client";
import { MEDIA_BUCKET, mediaUrl } from "@/lib/supabase/env";
import { ACCEPTED, prepareImage } from "@/lib/image";
import type { Court, Tournament } from "@/lib/types";

export function DetailsForm({ t }: { t: Tournament }) {
  return (
    <Section title="Event details" description="Shown on the public page. Leave anything blank to hide it.">
      <ActionForm action={updateTournamentDetails.bind(null, t.id)} className="grid max-w-2xl gap-4">
        {(pending) => (
          <>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required minLength={3} maxLength={120} defaultValue={t.name} />
            </div>
            <div>
              <Label htmlFor="subtitle" hint="optional">Subtitle</Label>
              <Input id="subtitle" name="subtitle" maxLength={160} defaultValue={t.subtitle ?? ""} placeholder="Annual open championship" />
            </div>
            <div>
              <Label htmlFor="host_name" hint="optional">Hosted by</Label>
              <Input id="host_name" name="host_name" maxLength={120} defaultValue={t.host_name ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="start_date">First day</Label>
                <Input id="start_date" name="start_date" type="date" required defaultValue={t.start_date} />
              </div>
              <div>
                <Label htmlFor="end_date">Last day</Label>
                <Input id="end_date" name="end_date" type="date" required defaultValue={t.end_date} />
              </div>
            </div>
            <div>
              <Label htmlFor="venue_name" hint="optional">Venue</Label>
              <Input id="venue_name" name="venue_name" maxLength={160} defaultValue={t.venue_name ?? ""} />
            </div>
            <div>
              <Label htmlFor="venue_address" hint="optional">Address</Label>
              <Input id="venue_address" name="venue_address" maxLength={300} defaultValue={t.venue_address ?? ""} />
            </div>
            <div>
              <Label htmlFor="venue_map_url" hint="optional, https link">Map link</Label>
              <Input id="venue_map_url" name="venue_map_url" type="url" maxLength={500} defaultValue={t.venue_map_url ?? ""} placeholder="https://maps.google.com/…" />
            </div>
            <div>
              <Label htmlFor="description" hint="optional">About the event</Label>
              <Textarea id="description" name="description" maxLength={4000} rows={5} defaultValue={t.description ?? ""} placeholder="Rules, prizes, shuttle type, reporting times…" />
            </div>
            <div>
              <Label htmlFor="visibility">Who can find it</Label>
              <Select id="visibility" name="visibility" defaultValue={t.visibility}>
                <option value="PUBLIC">Anyone with the link, and listed publicly later</option>
                <option value="UNLISTED">Only people with the link</option>
              </Select>
            </div>
            <div>
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save details"}</Button>
            </div>
          </>
        )}
      </ActionForm>
    </Section>
  );
}

export function SlugForm({ t }: { t: Tournament }) {
  return (
    <Section
      title="Web address"
      description={
        t.status === "DRAFT"
          ? "Change it freely while the tournament is a draft."
          : "If you change it, the old address keeps working and redirects here, so printed links and QR codes don't break."
      }
    >
      <ActionForm action={updateSlug.bind(null, t.id)} className="flex max-w-2xl flex-wrap items-end gap-3">
        {(pending) => (
          <>
            <div className="min-w-64 flex-1">
              <Label htmlFor="slug">Address</Label>
              <div className="flex items-center rounded-md border border-line focus-within:border-court focus-within:ring-1 focus-within:ring-court">
                <span className="pl-3 text-sm text-ink-soft">/t/</span>
                <input
                  id="slug"
                  name="slug"
                  required
                  minLength={3}
                  maxLength={60}
                  pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
                  defaultValue={t.slug}
                  className="h-10 w-full bg-transparent px-1 text-[15px] outline-none"
                />
              </div>
            </div>
            <Button type="submit" variant="secondary" disabled={pending}>Change address</Button>
          </>
        )}
      </ActionForm>
    </Section>
  );
}


export function ImagesForm({ t }: { t: Tournament }) {
  return (
    <Section title="Logo and banner" description="JPEG, PNG or WebP. Logos are cropped to a square and banners to 3:1 from the centre, then resized, so put the important part in the middle.">
      <div className="grid gap-6 sm:grid-cols-[12rem_1fr]">
        <ImagePicker t={t} kind="logo" />
        <ImagePicker t={t} kind="banner" />
      </div>
    </Section>
  );
}

function ImagePicker({ t, kind }: { t: Tournament; kind: "logo" | "banner" }) {
  const path = kind === "logo" ? t.logo_path : t.banner_path;
  const url = mediaUrl(path);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputId = `${kind}-file`;

  const upload = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const img = await prepareImage(file, kind);
      const supabase = createClient();
      const name = `${t.id}/${kind}-${crypto.randomUUID()}.${img.ext}`;
      const { error: upErr } = await supabase.storage.from(MEDIA_BUCKET).upload(name, img.blob, {
        contentType: img.ext === "webp" ? "image/webp" : "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      });
      if (upErr) {
        setError("Upload failed. Check your connection and try again.");
        return;
      }
      const res = await setTournamentImage(t.id, kind, name);
      if (!res.ok) {
        await supabase.storage.from(MEDIA_BUCKET).remove([name]);
        setError(res.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "That image couldn't be used.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{kind === "logo" ? "Logo" : "Banner"}</p>
      <div
        className={`flex items-center justify-center overflow-hidden rounded-md border border-dashed border-line bg-surface-2 ${kind === "logo" ? "aspect-square" : "aspect-[3/1]"}`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- user upload served from storage
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm text-ink-soft">None yet</span>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <label
          htmlFor={inputId}
          className="inline-flex h-8 cursor-pointer items-center rounded-md border border-line px-3 text-sm font-semibold hover:border-ink"
        >
          {busy ? "Uploading…" : url ? "Replace" : "Upload"}
        </label>
        <input
          id={inputId}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }}
        />
        {url && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await setTournamentImage(t.id, kind, null);
              if (!res.ok) setError(res.error);
              setBusy(false);
            }}
          >
            Remove
          </Button>
        )}
      </div>
      {error && <div className="mt-2"><Notice tone="error">{error}</Notice></div>}
    </div>
  );
}

export function CourtsForm({ tid, courts }: { tid: string; courts: Court[] }) {
  const { pending, error, run } = useAction();
  return (
    <Section title="Courts">
      <ul className="mb-4 flex max-w-2xl flex-wrap gap-2">
        {courts.map((c) => (
          <li key={c.id} className="flex items-center gap-1 rounded-md border border-line py-1 pr-1 pl-3 text-sm">
            {c.name}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteCourt(tid, c.id), `Remove ${c.name}? Matches assigned to it lose their court.`)}
              className="rounded px-1.5 text-ink-soft hover:bg-surface-2 hover:text-fault"
              aria-label={`Remove ${c.name}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {error && <div className="mb-3"><Notice tone="error">{error}</Notice></div>}
      <ActionForm action={addCourt.bind(null, tid)} resetOnSuccess className="flex max-w-md items-end gap-3">
        {(p) => (
          <>
            <div className="flex-1">
              <Label htmlFor="court-name">New court</Label>
              <Input id="court-name" name="name" required maxLength={40} placeholder={`Court ${courts.length + 1}`} />
            </div>
            <Button type="submit" variant="secondary" disabled={p}>Add court</Button>
          </>
        )}
      </ActionForm>
    </Section>
  );
}

export function DangerZone({ t }: { t: Tournament }) {
  return (
    <Section title="Delete tournament" description="This permanently deletes the tournament, its players, draws, results and images. It can't be undone.">
      <ActionForm action={deleteTournament.bind(null, t.id)} className="flex max-w-md flex-wrap items-end gap-3">
        {(pending) => (
          <>
            <div className="flex-1">
              <Label htmlFor="confirm" hint={`type ${t.slug}`}>Confirm</Label>
              <Input id="confirm" name="confirm" autoComplete="off" required />
            </div>
            <Button type="submit" variant="danger" disabled={pending}>Delete permanently</Button>
          </>
        )}
      </ActionForm>
    </Section>
  );
}
