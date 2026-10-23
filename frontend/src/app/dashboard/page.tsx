import { Overview } from "@/components/swiftkite/overview";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Overview",
  "Campaign delivery, failures and attention items at a glance.",
);

export default function Page() {
  return <Overview />;
}
