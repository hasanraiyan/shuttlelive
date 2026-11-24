const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const dayYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function formatDateRange(start: string, end: string) {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (start === end) return dayYear.format(s);
  if (s.getUTCFullYear() === e.getUTCFullYear()) return `${day.format(s)} to ${dayYear.format(e)}`;
  return `${dayYear.format(s)} to ${dayYear.format(e)}`;
}

export function siteUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
