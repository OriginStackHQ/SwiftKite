import { Suspense } from "react";

import { pageMetadata } from "@/lib/seo";

import { NewCampaign } from "./new-campaign";

export const metadata = pageMetadata(
  "Create campaign",
  "Start a new email campaign draft.",
);

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewCampaign />
    </Suspense>
  );
}
