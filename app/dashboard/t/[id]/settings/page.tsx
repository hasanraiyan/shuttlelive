import { Suspense } from "react";
import { CourtsForm, DangerZone, DetailsForm, ImagesForm, SlugForm } from "@/components/dashboard/settings-forms";
import { getOwnedBundle } from "@/lib/data";

export const metadata = { title: "Settings" };

export default function SettingsPage({ params }: PageProps<"/dashboard/t/[id]/settings">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Loading settings…</p>}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tournament: t, courts } = await getOwnedBundle(id);
  return (
    <div className="space-y-12">
      <DetailsForm key={t.updated_at} t={t} />
      <ImagesForm t={t} />
      <CourtsForm tid={t.id} courts={courts} />
      <SlugForm key={t.slug} t={t} />
      <DangerZone t={t} />
    </div>
  );
}
