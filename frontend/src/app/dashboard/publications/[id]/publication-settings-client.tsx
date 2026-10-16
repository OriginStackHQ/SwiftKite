"use client";

import { useParams } from "next/navigation";

import { PublicationSettings } from "@/components/newsflow/publications";

export function PublicationSettingsClient() {
  const params = useParams<{ id: string }>();

  return <PublicationSettings id={params.id} />;
}
