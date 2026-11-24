/** Colour helpers for the appearance studio (SRS FR-BRD-05, NFR-USE-01: WCAG 2.1 AA). */

export const HEX = /^#[0-9a-f]{6}$/;

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: number[]) {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

export function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** White or near-black text, whichever reads better on this background. */
export function textOn(bg: string, light = "#ffffff", dark = "#09090b") {
  return contrast(bg, light) >= contrast(bg, dark) ? light : dark;
}

/** Mix toward black until the colour reaches `target` contrast against white. */
export function readableOnWhite(hex: string, target = 4.5) {
  let c = rgb(hex);
  let out = hex;
  for (let i = 0; i < 40 && contrast(out, "#ffffff") < target; i++) {
    c = c.map((v) => v * 0.93);
    out = toHex(c);
  }
  return out;
}

/** Darker shade used for hover and pressed states. */
export function deepen(hex: string) {
  return toHex(rgb(hex).map((v) => v * 0.72));
}

/**
 * CSS variables that re-skin the public page with an event's colours.
 * The primary colour is darkened if needed so text and buttons stay readable.
 */
export function brandVars(primary: string | null, accent: string | null): Record<string, string> {
  const vars: Record<string, string> = {};
  // Text on a custom colour uses the theme's own paper/ink tokens (app/theme.css).
  const onColour = (bg: string) => (textOn(bg) === "#ffffff" ? "var(--sl-paper)" : "var(--sl-ink)");
  if (primary && HEX.test(primary)) {
    const p = readableOnWhite(primary);
    vars["--court"] = p;
    vars["--court-deep"] = deepen(p);
    vars["--court-line"] = onColour(p);
  }
  if (accent && HEX.test(accent)) {
    vars["--band"] = accent;
    vars["--on-band"] = onColour(accent);
  }
  return vars;
}
