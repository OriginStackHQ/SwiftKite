import { Suspense } from "react";

import { pageMetadata } from "@/lib/seo";

import { NewCampaign } from "./new-campaign";

export const metadata = pageMetadata(
  "Create campaign",
  "Compose and preview your next newsletter issue.",
);

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewCampaign />
    </Suspense>
  );
}
