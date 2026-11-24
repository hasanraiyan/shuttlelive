import Link from "next/link";
import { QuickMatchForm } from "@/components/dashboard/quick-match-form";

export const metadata = { title: "Quick match" };

export default function QuickMatchPage() {
  return (
    <>
      <Link href="/dashboard" className="text-sm text-ink-soft hover:text-ink">
        Back to your tournaments
      </Link>
      <h1 className="mt-3 font-display text-5xl">Quick match</h1>
      <p className="mt-2 mb-8 max-w-xl text-ink-soft">Score a single match without setting up a tournament.</p>
      <QuickMatchForm />
    </>
  );
}
