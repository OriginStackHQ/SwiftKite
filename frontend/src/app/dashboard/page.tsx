import { Overview } from "@/components/newsflow/overview";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Overview",
  "Your newsletter subscribers, campaigns, delivery and growth at a glance.",
);

export default function Page() {
  return <Overview />;
}
