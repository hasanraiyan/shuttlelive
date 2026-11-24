import { MatchesTab } from "@/components/dashboard/tabs";

export const metadata = { title: "Matches" };

// Static shell: the data comes from the tournament layout's shared context.
export default function Page() {
  return <MatchesTab />;
}
