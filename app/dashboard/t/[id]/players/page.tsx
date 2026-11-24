import { PlayersTab } from "@/components/dashboard/tabs";

export const metadata = { title: "Players" };

// Static shell: the data comes from the tournament layout's shared context.
export default function Page() {
  return <PlayersTab />;
}
