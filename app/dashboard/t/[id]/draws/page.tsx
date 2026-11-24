import { DrawsTab } from "@/components/dashboard/tabs";

export const metadata = { title: "Categories and draws" };

// Static shell: the data comes from the tournament layout's shared context.
export default function Page() {
  return <DrawsTab />;
}
