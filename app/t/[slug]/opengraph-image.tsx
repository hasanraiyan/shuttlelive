import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { formatDateRange } from "@/lib/format";
import { isActive } from "@/lib/scoring";
import { createPublicClient } from "@/lib/supabase/server";
import type { MatchWithGames, Tournament } from "@/lib/types";

export const alt = "Tournament live scores on ShuttleLive";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Brand colours come from app/theme.css so that file stays the only place to change them. */
async function brandColours() {
  const fallback = { court: "#059669", paper: "#ffffff", ink: "#09090b", emerald: "#10b981" };
  try {
    const css = await readFile(join(process.cwd(), "app/theme.css"), "utf8");
    const pick = (name: string, dflt: string) =>
      css.match(new RegExp(`--sl-${name}:\\s*(#[0-9a-fA-F]{3,8})`))?.[1] ?? dflt;
    return {
      court: pick("court", fallback.court),
      paper: pick("paper", fallback.paper),
      ink: pick("ink", fallback.ink),
      emerald: pick("emerald", fallback.emerald),
    };
  } catch {
    return fallback;
  }
}

/** Share card: event name, dates, and the live score if a match is on court. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await brandColours();
  const supabase = createPublicClient();

  // Anonymous client: drafts are invisible here, so a draft link never leaks its name.
  const { data: t } = /^[a-z0-9-]{3,60}$/.test(slug)
    ? await supabase.from("tournaments").select("*").eq("slug", slug).maybeSingle()
    : { data: null };

  let live: { a: string; b: string; sa: number; sb: number } | null = null;
  if (t) {
    const { data: matches } = await supabase
      .from("matches")
      .select("*, entry_a:entries!matches_entry_a_id_category_id_fkey(display_name), entry_b:entries!matches_entry_b_id_category_id_fkey(display_name)")
      .eq("tournament_id", (t as Tournament).id)
      .in("status", ["LIVE", "GAME_ENDED", "MATCH_WON_PENDING"])
      .order("updated_at", { ascending: false })
      .limit(1);
    const m = matches?.[0] as (MatchWithGames & { entry_a: { display_name: string } | null; entry_b: { display_name: string } | null }) | undefined;
    if (m && isActive(m)) {
      live = { a: m.entry_a?.display_name ?? "", b: m.entry_b?.display_name ?? "", sa: m.score_a, sb: m.score_b };
    }
  }

  const tournament = t as Tournament | null;
  const title = tournament?.name ?? "ShuttleLive";
  const sub = tournament
    ? `${formatDateRange(tournament.start_date, tournament.end_date)}${tournament.venue_name ? `, ${tournament.venue_name}` : ""}`
    : "Badminton tournaments, scored live";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: c.court,
          color: c.paper,
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {tournament?.host_name && <div style={{ fontSize: 30, opacity: 0.85 }}>{tournament.host_name}</div>}
          <div style={{ fontSize: title.length > 40 ? 64 : 84, fontWeight: 800, lineHeight: 1.05, marginTop: 8 }}>{title}</div>
          <div style={{ fontSize: 32, marginTop: 20, opacity: 0.9 }}>{sub}</div>
        </div>

        {live ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: c.paper,
              color: c.ink,
              borderRadius: 16,
              padding: "24px 36px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", fontSize: 34, maxWidth: 760 }}>
              <div style={{ display: "flex", alignItems: "center", fontSize: 24, color: c.court, fontWeight: 700 }}>
                <div style={{ width: 14, height: 14, borderRadius: 7, background: c.emerald, marginRight: 10 }} />
                Live now
              </div>
              <div style={{ marginTop: 6 }}>{live.a}</div>
              <div>{live.b}</div>
            </div>
            <div style={{ display: "flex", fontSize: 96, fontWeight: 800 }}>
              {live.sa}–{live.sb}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 30, opacity: 0.9 }}>Live scores, draws and results on ShuttleLive</div>
        )}
      </div>
    ),
    size
  );
}
