import { Analytics } from "@/components/newsflow/analytics";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Analytics",
  "Honest analytics for newsletter delivery, audience growth and estimated engagement.",
);

export default function Page() {
  return <Analytics />;
}
