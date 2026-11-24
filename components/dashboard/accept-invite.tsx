"use client";

import { useAction } from "@/components/app/action-form";
import { Button, Notice } from "@/components/app/ui";
import { acceptInvite } from "@/lib/actions/orgs";

export function AcceptInvite({ token }: { token: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="mt-6">
      <Button size="lg" disabled={pending} onClick={() => run(() => acceptInvite(token))}>
        {pending ? "Joining…" : "Accept invite"}
      </Button>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </div>
  );
}
