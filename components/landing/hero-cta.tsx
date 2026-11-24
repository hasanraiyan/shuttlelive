"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function HeroCta() {
  const [signedIn, setSignedIn] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data?.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session?.user);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (signedIn) {
    return (
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="rounded-md bg-court px-5 py-3 text-sm font-semibold text-court-line hover:bg-court-deep"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/dashboard/new"
          className="rounded-md border border-line bg-surface-2 px-5 py-3 text-sm font-semibold text-ink hover:bg-line"
        >
          + Create tournament
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Link
        href="/sign-up"
        className="rounded-md bg-court px-5 py-3 text-sm font-semibold text-court-line hover:bg-court-deep"
      >
        Create a tournament
      </Link>
      <Link
        href="/sign-in"
        className="rounded-md border border-line bg-surface-2 px-5 py-3 text-sm font-semibold text-ink hover:bg-line"
      >
        Sign in
      </Link>
    </div>
  );
}
