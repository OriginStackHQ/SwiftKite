import { SubscriberPage } from "@/components/newsflow/public-pages";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "You’re unsubscribed",
  "Your newsletter unsubscribe confirmation.",
);

export default function Page() {
  return <SubscriberPage type="unsubscribed" />;
}
