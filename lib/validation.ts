import { z } from "zod";

const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} is required.` })
    .trim()
    .min(min, min === 1 ? `${label} is required.` : `${label} needs at least ${min} characters.`)
    .max(max, `${label} can be at most ${max} characters.`);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : null));

export const uuid = z.string().uuid("Invalid id.");

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "The web address needs at least 3 characters.")
  .max(60, "The web address can be at most 60 characters.")
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Use lowercase letters, numbers and single hyphens.")
  .refine((s) => !s.includes("--"), "Use single hyphens only.");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^https:\/\/[^\s<>"]+$/.test(v), "Use a full https:// link.");

export const tournamentDetailsSchema = z
  .object({
    name: trimmed(3, 120, "Name"),
    subtitle: optionalText(160, "Subtitle"),
    description: optionalText(4000, "Description"),
    host_name: optionalText(120, "Host"),
    venue_name: optionalText(160, "Venue"),
    venue_address: optionalText(300, "Address"),
    venue_map_url: httpsUrl,
    start_date: isoDate,
    end_date: isoDate,
    visibility: z.enum(["PUBLIC", "UNLISTED"]).default("PUBLIC"),
  })
  .refine((d) => d.end_date >= d.start_date, { message: "The end date can't be before the start date.", path: ["end_date"] });

export const createTournamentSchema = tournamentDetailsSchema.and(
  z.object({
    slug: slugSchema,
    courts: z.coerce.number().int().min(1, "Add at least one court.").max(30, "Up to 30 courts."),
  })
);

export const courtNameSchema = trimmed(1, 40, "Court name");

export const categorySchema = z.object({
  name: trimmed(2, 60, "Category name"),
  kind: z.enum(["SINGLES", "DOUBLES"]),
  rule_preset: z.enum(["BWF_21", "BAI_15", "QUICK_21", "SHORT_15"]),
});

export const playerSchema = z.object({
  name: trimmed(1, 80, "Player name"),
  club: optionalText(80, "Club"),
});

export function firstError(e: z.ZodError) {
  return e.issues[0]?.message ?? "Check the form and try again.";
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}
