import { Suspense } from "react";
import { DrawsManager } from "@/components/dashboard/draws-manager";
import { getOwnedBundle } from "@/lib/data";

export const metadata = { title: "Categories and draws" };

export default function DrawsPage({ params }: PageProps<"/dashboard/t/[id]/draws">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Loading categories…</p>}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getOwnedBundle(id);
  return (
    <DrawsManager
      tid={b.tournament.id}
      categories={b.categories}
      players={b.players}
      entries={b.entries}
      matches={b.matches}
      courts={b.courts}
    />
  );
}
