import { Campaigns } from "@/components/newsflow/campaigns";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Campaigns",
  "Create, manage and measure newsletter campaigns.",
);

export default function Page() {
  return <Campaigns />;
}
