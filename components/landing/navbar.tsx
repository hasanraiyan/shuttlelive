"use client";

import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/layout/app-icon";
import { createClient } from "@/lib/supabase/client";

export function LandingNavbar() {
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

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm font-medium sm:gap-2">
          {signedIn ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-2 text-ink-soft hover:text-ink"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/new"
                className="rounded-md bg-ink px-4 py-2 font-semibold text-surface hover:bg-court"
              >
                + New tournament
              </Link>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="rounded-md px-3 py-2 text-ink-soft hover:text-ink">
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-md bg-ink px-4 py-2 font-semibold text-surface hover:bg-court"
              >
                Create a tournament
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
