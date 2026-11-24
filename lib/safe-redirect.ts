/** Only same-site relative paths are allowed after sign-in (SRS SEC-07). */
export function safePath(input: string | null | undefined, fallback = "/dashboard") {
  if (!input) return fallback;
  if (!input.startsWith("/") || input.startsWith("//") || input.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(input)) return fallback;
  return input;
}
