"use client";

import { ActionForm } from "@/components/app/action-form";
import { Button, Input, Label } from "@/components/app/ui";
import { createOrganization } from "@/lib/actions/orgs";

export function NewOrgForm() {
  return (
    <ActionForm action={createOrganization} className="mt-4 grid gap-3">
      {(pending) => (
        <>
          <div>
            <Label htmlFor="org-name">Name</Label>
            <Input id="org-name" name="name" required minLength={2} maxLength={120} placeholder="Riverside Badminton Club" />
          </div>
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create organization"}
            </Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
