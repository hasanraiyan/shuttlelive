import Link from "next/link";
import { Logo } from "@/components/layout/app-icon";
import { signOut } from "@/lib/actions/tournaments";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      <header className="border-b border-line print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-1 text-sm font-medium">
            <Link href="/dashboard" className="rounded-md px-3 py-2 text-ink-soft hover:text-ink">
              Tournaments
            </Link>
            <Link href="/dashboard/orgs" className="rounded-md px-3 py-2 text-ink-soft hover:text-ink">
              Organizations
            </Link>
            <form action={signOut}>
              <button type="submit" className="rounded-md px-3 py-2 text-ink-soft hover:text-ink">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
