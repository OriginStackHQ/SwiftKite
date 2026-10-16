import { Subscribers } from "@/components/newsflow/subscribers";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Subscribers",
  "Manage subscriber consent, status and audience activity.",
);

export default function Page() {
  return <Subscribers />;
}
