import Link from "next/link";
import { Suspense } from "react";
import { OrgManager } from "@/components/dashboard/org-manager";
import { getOrgPage } from "@/lib/data";

export const metadata = { title: "Organization" };

export default function OrgPage({ params }: PageProps<"/dashboard/orgs/[orgId]">) {
  return (
    <>
      <Link href="/dashboard/orgs" className="text-sm text-ink-soft hover:text-ink">
        All organizations
      </Link>
      <div className="mt-3">
        <Suspense fallback={<p className="text-sm text-ink-soft">Loading organization…</p>}>
          <Content params={params} />
        </Suspense>
      </div>
    </>
  );
}

async function Content({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const page = await getOrgPage(orgId);
  return <OrgManager {...page} />;
}
