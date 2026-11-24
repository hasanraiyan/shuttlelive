import Link from "next/link";
import { Logo } from "@/components/layout/app-icon";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <h1 className="font-display text-5xl">This page isn&apos;t here</h1>
      <p className="max-w-md text-ink-soft">
        The link may be wrong, or the tournament hasn&apos;t been published yet.
      </p>
      <Link href="/" className="rounded-md bg-court px-5 py-3 text-sm font-semibold text-court-line hover:bg-court-deep">
        Go to the home page
      </Link>
    </div>
  );
}
