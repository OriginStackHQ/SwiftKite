import { Archive } from "@/components/newsflow/public-pages";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Newsletter archive",
  "Read past newsletter issues published with NewsFlow.",
);

export function generateStaticParams() {
  return [
    { publicId: "pub_8f3k2j" },
    { publicId: "pub_q7m9z1" },
    { publicId: "pub_t4k8n6" },
  ];
}

export default async function Page({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  return <Archive id={publicId} />;
}
