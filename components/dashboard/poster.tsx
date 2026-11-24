"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Button, Notice } from "@/components/app/ui";
import { useTournament } from "@/components/dashboard/tournament-context";
import { brandVars, textOn } from "@/lib/color";
import { formatDateRange, siteUrl } from "@/lib/format";
import { mediaUrl } from "@/lib/supabase/env";

/** QR modules use the brand ink colour from app/theme.css. */
function inkColor() {
  if (typeof document === "undefined") return "#000000";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--sl-ink").trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#000000";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

/** Printable A4 poster with a QR code to the public page (SRS P1: printable QR codes). */
export function PosterTab() {
  const { bundle } = useTournament();
  const t = bundle.tournament;
  const url = siteUrl(`/t/${t.slug}`);
  const [svg, setSvg] = React.useState<string>("");
  const [downloading, setDownloading] = React.useState(false);
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

  /** Generates and downloads the full A4 tournament poster as a high-resolution PNG image. */
  const downloadCompletePoster = async () => {
    try {
      setDownloading(true);
      const width = 1600;
      const height = 2263; // A4 ratio 210 x 297
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 1. Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // 2. Header
      const headerHeight = Math.round(height * 0.25);
      const primaryColor = t.brand_primary ?? "#059669";
      ctx.fillStyle = primaryColor;
      ctx.fillRect(0, 0, width, headerHeight);

      const headerTextColor = textOn(primaryColor, "#ffffff", "#09090b");
      const padX = Math.round(width * 0.08);
      let contentLeft = padX;

      // Draw Logo if available
      if (logo) {
        try {
          const logoImg = await loadImage(logo);
          const logoSize = Math.round(headerHeight * 0.54);
          const logoY = Math.round((headerHeight - logoSize) / 2);
          const radius = 24;

          ctx.save();
          ctx.beginPath();
          ctx.roundRect(padX, logoY, logoSize, logoSize, radius);
          ctx.clip();
          ctx.drawImage(logoImg, padX, logoY, logoSize, logoSize);
          ctx.restore();

          // Border around logo
          ctx.save();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.roundRect(padX, logoY, logoSize, logoSize, radius);
          ctx.stroke();
          ctx.restore();

          contentLeft = padX + logoSize + 44;
        } catch {
          // If logo cross-origin fails, gracefully continue without blocking download
        }
      }

      // Draw Host Name
      ctx.save();
      ctx.fillStyle = headerTextColor;
      ctx.globalAlpha = 0.85;
      ctx.font = "600 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      if (host) {
        ctx.fillText(host, contentLeft, Math.round(headerHeight * 0.30));
      }
      ctx.restore();

      // Draw Tournament Title (with multi-line wrap if needed)
      ctx.save();
      ctx.fillStyle = headerTextColor;
      ctx.font = "bold 60px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const maxTitleWidth = width - contentLeft - padX;
      const titleLines = wrapText(ctx, t.name, maxTitleWidth);
      const startY = host ? Math.round(headerHeight * 0.44) : Math.round(headerHeight * 0.36);
      const lineHeight = 70;
      titleLines.slice(0, 2).forEach((line, i) => {
        ctx.fillText(line, contentLeft, startY + i * lineHeight);
      });
      ctx.restore();

      // Draw Dates & Venue
      ctx.save();
      ctx.fillStyle = headerTextColor;
      ctx.globalAlpha = 0.95;
      ctx.font = "500 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const dateText = formatDateRange(t.start_date, t.end_date);
      const venueText = t.venue_name ? `${dateText}, ${t.venue_name}` : dateText;
      ctx.fillText(venueText, padX, headerHeight - 44);
      ctx.restore();

      // 3. Body Section
      const bodyTop = headerHeight;

      // "Scan for live scores"
      ctx.save();
      ctx.fillStyle = "#09090b";
      ctx.font = "bold 64px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Scan for live scores", width / 2, bodyTop + 140);
      ctx.restore();

      // QR Code
      const qrSize = Math.round(width * 0.54); // ~864px
      const qrX = Math.round((width - qrSize) / 2);
      const qrY = bodyTop + 200;

      const qrDataUrl = await QRCode.toDataURL(url, {
        width: qrSize,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#09090b", light: "#ffffff" },
      });
      const qrImg = await loadImage(qrDataUrl);
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // Subtitle
      ctx.save();
      ctx.fillStyle = "#64748b";
      ctx.font = "500 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "Draws, courts, results and commentary, live on your phone. No app needed.",
        width / 2,
        qrY + qrSize + 70
      );
      ctx.restore();

      // Clean URL
      ctx.save();
      ctx.fillStyle = "#09090b";
      ctx.font = "600 36px monospace";
      ctx.textAlign = "center";
      ctx.fillText(url.replace(/^https?:\/\//, ""), width / 2, qrY + qrSize + 130);
      ctx.restore();

      // 4. Footer
      ctx.save();
      ctx.fillStyle = "#94a3b8";
      ctx.font = "500 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Powered by ShuttleLive", width / 2, height - 50);
      ctx.restore();

      // Export Blob and Trigger Download
      canvas.toBlob((blob) => {
        if (!blob) return;
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `${t.slug}-poster.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
      }, "image/png");
    } catch (err) {
      console.error("Failed to generate poster PNG", err);
    } finally {
      setDownloading(false);
    }
  };

  /** Downloads only the isolated QR code image for custom graphic designers. */
  const downloadQROnly = async (kind: "png" | "svg") => {
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
        <Button onClick={downloadCompletePoster} disabled={downloading}>
          {downloading ? "Generating poster…" : "Download Complete Poster (PNG)"}
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          Print poster (A4 / PDF)
        </Button>
        <Button variant="secondary" onClick={() => downloadQROnly("png")}>
          Download QR code only (PNG)
        </Button>
        <Button variant="secondary" onClick={() => downloadQROnly("svg")}>
          Download QR code only (SVG)
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
