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
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <Logo className="shrink-0" />
        <nav className="flex shrink-0 items-center gap-1 text-xs font-medium sm:gap-2 sm:text-sm">
          <Link
            href="/#tournaments"
            className="hidden whitespace-nowrap rounded-md px-3 py-2 text-ink-soft hover:text-ink sm:inline-block"
          >
            Tournaments
          </Link>
          {signedIn ? (
            <>
              <Link
                href="/dashboard"
                className="whitespace-nowrap rounded-md px-2.5 py-2 text-ink-soft hover:text-ink sm:px-3"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/new"
                className="whitespace-nowrap rounded-md bg-ink px-3 py-2 font-semibold text-surface hover:bg-court sm:px-4"
              >
                <span className="sm:hidden">+ New</span>
                <span className="hidden sm:inline">+ New tournament</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="whitespace-nowrap rounded-md px-2.5 py-2 text-ink-soft hover:text-ink sm:px-3"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="whitespace-nowrap rounded-md bg-ink px-3 py-2 font-semibold text-surface hover:bg-court sm:px-4"
              >
                <span className="sm:hidden">Host event</span>
                <span className="hidden sm:inline">Create a tournament</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
