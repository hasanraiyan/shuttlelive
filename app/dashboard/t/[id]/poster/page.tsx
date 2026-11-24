import { PosterTab } from "@/components/dashboard/poster";

export const metadata = { title: "QR poster" };

// Static shell: the data comes from the tournament layout's shared context.
export default function Page() {
  return <PosterTab />;
}
