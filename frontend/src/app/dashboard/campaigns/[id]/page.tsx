import { pageMetadata } from "@/lib/seo";

import { CampaignDetailClient } from "./campaign-detail-client";

export const metadata = pageMetadata(
  "Campaign",
  "Edit a draft or follow every delivery in a running campaign.",
);

export default function Page() {
  return <CampaignDetailClient />;
}
