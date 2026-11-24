"use client";

import * as React from "react";
import { ActionForm } from "@/components/app/action-form";
import { Button, Input, Label, Select } from "@/components/app/ui";
import { createTournament } from "@/lib/actions/tournaments";
import { slugify } from "@/lib/validation";

export function NewTournamentForm() {
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugEdited, setSlugEdited] = React.useState(false);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <ActionForm action={createTournament} className="grid max-w-2xl gap-5">
      {(pending) => (
        <>
          <div>
            <Label htmlFor="name">Tournament name</Label>
            <Input
              id="name"
              name="name"
              required
              minLength={3}
              maxLength={120}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugEdited) setSlug(slugify(e.target.value));
              }}
              placeholder="Winter Open 2026"
            />
          </div>

          <div>
            <Label htmlFor="slug" hint="the public link">Web address</Label>
            <div className="flex items-center rounded-md border border-line focus-within:border-court focus-within:ring-1 focus-within:ring-court">
              <span className="pl-3 text-sm text-ink-soft">/t/</span>
              <input
                id="slug"
                name="slug"
                required
                minLength={3}
                maxLength={60}
                pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                className="h-10 w-full bg-transparent px-1 text-[15px] outline-none"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="host_name" hint="optional">Hosted by</Label>
            <Input id="host_name" name="host_name" maxLength={120} placeholder="Riverside Badminton Club" />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="start_date">First day</Label>
              <Input id="start_date" name="start_date" type="date" required defaultValue={today} />
            </div>
            <div>
              <Label htmlFor="end_date">Last day</Label>
              <Input id="end_date" name="end_date" type="date" required defaultValue={today} />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
            <div>
              <Label htmlFor="venue_name" hint="optional">Venue</Label>
              <Input id="venue_name" name="venue_name" maxLength={160} placeholder="City Sports Hall" />
            </div>
            <div>
              <Label htmlFor="courts">Courts</Label>
              <Input id="courts" name="courts" type="number" min={1} max={30} defaultValue={2} required />
            </div>
          </div>

          <div>
            <Label htmlFor="visibility">Who can find it</Label>
            <Select id="visibility" name="visibility" defaultValue="PUBLIC">
              <option value="PUBLIC">Anyone with the link, and listed publicly later</option>
              <option value="UNLISTED">Only people with the link</option>
            </Select>
          </div>

          <p className="text-sm text-ink-soft">
            New tournaments start as drafts. Only you can see a draft until you publish it.
          </p>
          <div>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Creating…" : "Create tournament"}
            </Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
