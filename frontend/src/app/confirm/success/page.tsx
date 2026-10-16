import { SubscriberPage } from "@/components/newsflow/public-pages";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "You’re subscribed",
  "Welcome to the Tech Insights newsletter.",
);

export default function Page() {
  return <SubscriberPage type="success" />;
}
