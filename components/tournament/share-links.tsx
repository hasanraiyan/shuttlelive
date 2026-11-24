"use client";

import * as React from "react";

/** Copy link and WhatsApp share for the public page. */
export function ShareLinks({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = React.useState(false);
  const text = `${title}: follow live scores at ${url}`;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-2 px-4 py-3 text-sm">
      <span className="mr-auto min-w-0 truncate text-ink-soft">{url}</span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard blocked; the link is visible to copy by hand */
          }
        }}
        className="rounded-md border border-line bg-surface px-3 py-1.5 font-semibold hover:border-ink"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md bg-court px-3 py-1.5 font-semibold text-court-line hover:bg-court-deep"
      >
        Share on WhatsApp
      </a>
    </div>
  );
}
