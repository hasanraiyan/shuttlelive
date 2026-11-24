import Link from "next/link";
import { Suspense } from "react";
import { NewTournamentForm } from "@/components/dashboard/new-tournament-form";
import { listMyOrganizations } from "@/lib/data";

export const metadata = { title: "Create a tournament" };

export default function NewTournamentPage() {
  return (
    <>
      <Link href="/dashboard" className="text-sm text-ink-soft hover:text-ink">
        Back to your tournaments
      </Link>
      <h1 className="mt-3 mb-8 font-display text-5xl">Create a tournament</h1>
      <Suspense fallback={<NewTournamentForm />}>
        <WithOrgs />
      </Suspense>
    </>
  );
}

async function WithOrgs() {
  const orgs = await listMyOrganizations();
  return <NewTournamentForm orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} />;
}
