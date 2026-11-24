import Link from "next/link";
import { Logo } from "@/components/layout/app-icon";

export function LandingNavbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm font-medium sm:gap-2">
          <Link
            href="/sign-in?mode=umpire"
            className="hidden rounded-md px-3 py-2 text-ink-soft hover:text-ink sm:block"
          >
            Enter umpire PIN
          </Link>
          <Link href="/sign-in" className="rounded-md px-3 py-2 text-ink-soft hover:text-ink">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md bg-ink px-4 py-2 font-semibold text-surface hover:bg-court"
          >
            Create a tournament
          </Link>
        </nav>
      </div>
    </header>
  );
}
