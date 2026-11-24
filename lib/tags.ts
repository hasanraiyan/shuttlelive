/** Cache tags for the public tournament page. Server actions revalidate these after every change. */
export const tags = {
  tournament: (id: string) => `tournament:${id}`,
  slug: (slug: string) => `slug:${slug}`,
};
