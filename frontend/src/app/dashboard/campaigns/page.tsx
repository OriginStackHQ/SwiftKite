import { Campaigns } from "@/components/swiftkite/campaigns";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Campaigns",
  "Create, send and track email campaigns.",
);

export default function Page() {
  return <Campaigns />;
}
