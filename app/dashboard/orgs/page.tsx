import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/app/ui";
import { NewOrgForm } from "@/components/dashboard/new-org-form";
import { listMyOrganizations } from "@/lib/data";

export const metadata = { title: "Organizations" };

export default function OrgsPage() {
  return (
    <>
      <h1 className="font-display text-5xl">Organizations</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Run tournaments together. Everyone in an organization can manage its tournaments, from players to scoring.
      </p>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem] lg:items-start">
        <Suspense fallback={<p className="text-sm text-ink-soft">Loading…</p>}>
          <List />
        </Suspense>
        <section className="border-t border-line pt-6">
          <h2 className="font-display text-2xl">Create an organization</h2>
          <NewOrgForm />
        </section>
      </div>
    </>
  );
}

async function List() {
  const orgs = await listMyOrganizations();
  if (!orgs.length) {
    return <EmptyState title="You're not in any organizations">Create one, or open an invite link someone sent you.</EmptyState>;
  }
  return (
    <ul className="divide-y divide-line border-y border-line">
      {orgs.map((o) => (
        <li key={o.id}>
          <Link href={`/dashboard/orgs/${o.id}`} className="flex items-center justify-between gap-3 py-4 hover:bg-surface-2 sm:px-3">
            <span className="truncate text-lg font-semibold">{o.name}</span>
            <span className="shrink-0 text-sm text-ink-soft">{o.role === "OWNER" ? "Owner" : "Organizer"}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
