"use client";

import { useParams } from "next/navigation";

import { CampaignDetail } from "@/components/newsflow/campaign-detail";

export function CampaignDetailClient() {
  const params = useParams<{ id: string }>();

  return <CampaignDetail id={params.id} />;
}
