import * as React from "react";
import { Logo } from "@/components/layout/app-icon";
import { CourtLines } from "@/components/court/court-lines";

type AuthShellProps = {
  title: string;
  subtitle: string;
  panelTitle?: string;
  panelBody?: string;
  children: React.ReactNode;
};

export function AuthShell({
  title,
  subtitle,
  panelTitle = "Run the tournament. Everyone follows the score.",
  panelBody = "Draws, court schedules, one-tap umpire scoring and a live page for every event.",
  children,
}: AuthShellProps) {
  return (
    <div className="grid min-h-screen w-full bg-surface text-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-h-screen flex-col px-5 pt-6 sm:px-12 sm:pt-8">
        <Logo />
        <main className="m-auto w-full max-w-[400px] py-12">
          <h1 className="font-display text-[clamp(2.5rem,4vw,3.25rem)]">{title}</h1>
          <p className="mt-3 leading-relaxed text-ink-soft">{subtitle}</p>
          <div className="mt-8 flex flex-col">{children}</div>
        </main>
      </div>

      <aside className="relative m-3 hidden overflow-hidden rounded-lg bg-court text-court-line lg:flex lg:flex-col lg:justify-end">
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <CourtLines orientation="vertical" className="h-full max-h-[78vh] w-auto opacity-35" />
        </div>
        <div className="relative bg-gradient-to-t from-court via-court/90 to-transparent p-10 pt-24 xl:p-12 xl:pt-28">
          <p className="max-w-[16ch] font-display text-[clamp(2.5rem,3.6vw,3.5rem)]">{panelTitle}</p>
          <p className="mt-4 max-w-[42ch] leading-relaxed opacity-85">{panelBody}</p>
        </div>
      </aside>
    </div>
  );
}
