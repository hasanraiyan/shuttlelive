import { SettingsTab } from "@/components/dashboard/tabs";

export const metadata = { title: "Settings" };

// Static shell: the data comes from the tournament layout's shared context.
export default function Page() {
  return <SettingsTab />;
}
