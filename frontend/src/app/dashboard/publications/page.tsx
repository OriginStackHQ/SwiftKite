import { Publications } from "@/components/newsflow/publications";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Publications",
  "Manage your NewsFlow newsletters and publication details.",
);

export default function Page() {
  return <Publications />;
}
