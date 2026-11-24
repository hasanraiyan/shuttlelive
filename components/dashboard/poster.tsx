"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Button, Notice } from "@/components/app/ui";
import { useTournament } from "@/components/dashboard/tournament-context";
import { brandVars } from "@/lib/color";
import { formatDateRange, siteUrl } from "@/lib/format";
import { mediaUrl } from "@/lib/supabase/env";

/** QR modules use the brand ink colour from app/theme.css. */
function inkColor() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--sl-ink").trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#000000";
}

/** Printable A4 poster with a QR code to the public page (SRS P1: printable QR codes). */
export function PosterTab() {
  const { bundle } = useTournament();
  const t = bundle.tournament;
  const url = siteUrl(`/t/${t.slug}`);
  const [svg, setSvg] = React.useState<string>("");
  const vars = brandVars(t.brand_primary, t.brand_accent);
  const logo = mediaUrl(t.logo_path) ?? mediaUrl(bundle.organization?.logo_path);
  const host = t.host_name ?? bundle.organization?.name ?? null;

  React.useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: inkColor(), light: "#0000" } })
      .then((s) => {
        if (!cancelled) setSvg(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);

  const download = async (kind: "png" | "svg") => {
    const file = `${t.slug}-qr.${kind}`;
    let href: string;
    if (kind === "png") {
      href = await QRCode.toDataURL(url, { width: 1200, margin: 2, errorCorrectionLevel: "M", color: { dark: inkColor() } });
    } else {
      const s = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: inkColor() } });
      href = URL.createObjectURL(new Blob([s], { type: "image/svg+xml" }));
    }
    const a = document.createElement("a");
    a.href = href;
    a.download = file;
    a.click();
    if (kind === "svg") setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  return (
    <div>
      <style>{`@media print { @page { size: A4 portrait; margin: 0; } }`}</style>

      <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
        <Button onClick={() => window.print()}>Print poster</Button>
        <Button variant="secondary" onClick={() => download("png")}>
          Download QR as PNG
        </Button>
        <Button variant="secondary" onClick={() => download("svg")}>
          Download QR as SVG
        </Button>
      </div>
      {t.status === "DRAFT" && (
        <div className="mb-6 print:hidden">
          <Notice tone="info">
            This tournament is still a draft, so the code opens a &quot;not found&quot; page for everyone else. Publish it before you print.
          </Notice>
        </div>
      )}

      {/* A4 page: 210 × 297 mm */}
      <article
        style={vars}
        className="mx-auto flex aspect-[210/297] w-full max-w-[640px] flex-col overflow-hidden border border-line bg-surface text-ink shadow-sm print:max-w-none print:border-0 print:shadow-none"
      >
        <header className="bg-court px-[8%] py-[7%] text-court-line">
          <div className="flex items-center gap-[4%]">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element -- organizer upload from storage
              <img src={logo} alt="" className="size-[18%] shrink-0 rounded-lg bg-surface object-cover" />
            )}
            <div className="min-w-0">
              {host && <p className="text-[clamp(0.7rem,2.2vw,1rem)] opacity-85">{host}</p>}
              <h1 className="font-display text-[clamp(1.6rem,6.5vw,3.25rem)] leading-[0.95]">{t.name}</h1>
            </div>
          </div>
          <p className="mt-[4%] text-[clamp(0.75rem,2.4vw,1.1rem)]">
            {formatDateRange(t.start_date, t.end_date)}
            {t.venue_name ? `, ${t.venue_name}` : ""}
          </p>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-[4%] px-[10%]">
          <p className="font-display text-center text-[clamp(1.4rem,5vw,2.6rem)]">Scan for live scores</p>
          <div
            aria-label={`QR code linking to ${url}`}
            role="img"
            className="aspect-square w-[62%] [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <p className="text-center text-[clamp(0.7rem,2.2vw,1rem)] text-ink-soft">
            Draws, courts, results and commentary, live on your phone. No app needed.
          </p>
          <p className="break-all text-center font-semibold text-[clamp(0.75rem,2.4vw,1.1rem)]">{url.replace(/^https?:\/\//, "")}</p>
        </div>

        <footer className="px-[8%] pb-[5%] text-center text-[clamp(0.6rem,1.8vw,0.85rem)] text-ink-soft">Powered by ShuttleLive</footer>
      </article>
    </div>
  );
}
