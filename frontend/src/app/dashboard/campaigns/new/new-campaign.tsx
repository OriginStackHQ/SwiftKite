"use client";

import { useSearchParams } from "next/navigation";

import { CampaignEditor } from "@/components/newsflow/editor";

export function NewCampaign() {
  const searchParams = useSearchParams();
  const draft = searchParams.get("draft") ?? undefined;

  return <CampaignEditor draft={draft} />;
}
