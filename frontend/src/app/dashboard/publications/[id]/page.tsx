import { PublicationSettings } from "@/components/newsflow/publications";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Publication settings",
  "Manage sender details, subscription preferences and public forms.",
);

export function generateStaticParams() {
  return [{ id: "pub_8f3k2j" }, { id: "pub_q7m9z1" }, { id: "pub_t4k8n6" }];
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PublicationSettings id={id} />;
}
