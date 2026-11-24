import { ScoreTab } from "@/components/dashboard/tabs";

export const metadata = { title: "Score match" };

// Static shell: the data comes from the tournament layout's shared context.
export default function Page() {
  return <ScoreTab />;
}
