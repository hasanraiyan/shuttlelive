/** Cache tags for public pages. Server actions revalidate these after every change. */
export const tags = {
  tournament: (id: string) => `tournament:${id}`,
  slug: (slug: string) => `slug:${slug}`,
  publicTournaments: "public-tournaments",
};
