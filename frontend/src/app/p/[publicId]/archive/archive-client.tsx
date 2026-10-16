"use client";

import { useParams } from "next/navigation";

import { Archive } from "@/components/newsflow/public-pages";

export function ArchiveClient() {
  const params = useParams<{ publicId: string }>();

  return <Archive id={params.publicId} />;
}
