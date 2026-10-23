"use client";

import { useParams } from "next/navigation";

import { CampaignDetail } from "@/components/swiftkite/campaign-detail";

export function CampaignDetailClient() {
  const params = useParams<{ id: string }>();

  return <CampaignDetail id={params.id} />;
}
