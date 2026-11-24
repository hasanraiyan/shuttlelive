"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function TournamentTabs({ id }: { id: string }) {
  const path = usePathname();
  const base = `/dashboard/t/${id}`;
  const tabs = [
    { href: base, label: "Matches" },
    { href: `${base}/players`, label: "Players" },
    { href: `${base}/draws`, label: "Categories and draws" },
    { href: `${base}/poster`, label: "QR poster" },
    { href: `${base}/settings`, label: "Settings" },
  ];
  return (
    <nav aria-label="Tournament sections" className="-mb-px flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const active = t.href === base ? path === base : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap",
              active ? "border-court text-ink" : "border-transparent text-ink-soft hover:text-ink"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
