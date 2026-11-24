"use client";

import Link from "next/link";
import { useAction } from "@/components/app/action-form";
import { Button, Notice } from "@/components/app/ui";
import { setTournamentStatus } from "@/lib/actions/tournaments";
import type { TournamentStatus } from "@/lib/types";

export function PublishControls({ id, slug, status }: { id: string; slug: string; status: TournamentStatus }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/t/${slug}`}
          target="_blank"
          className="inline-flex h-10 items-center rounded-md border border-line px-4 text-sm font-semibold hover:border-ink"
        >
          {status === "DRAFT" ? "Preview public page" : "Open public page"}
        </Link>
        {status === "DRAFT" && (
          <Button disabled={pending} onClick={() => run(() => setTournamentStatus(id, "PUBLISHED"))}>
            Publish
          </Button>
        )}
        {status === "PUBLISHED" && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(() => setTournamentStatus(id, "COMPLETED"), "Mark this tournament as completed? You can still reopen it.")
            }
          >
            Mark completed
          </Button>
        )}
        {status === "COMPLETED" && (
          <Button variant="secondary" disabled={pending} onClick={() => run(() => setTournamentStatus(id, "PUBLISHED"))}>
            Reopen
          </Button>
        )}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
