import { CampaignDetail } from "@/components/newsflow/campaign-detail";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Campaign delivery",
  "Track recipient states, delivery progress and estimated engagement.",
);

export function generateStaticParams() {
  return Array.from({ length: 12 }, (_, i) => ({ id: `cmp_${i + 1}` }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CampaignDetail id={id} />;
}
