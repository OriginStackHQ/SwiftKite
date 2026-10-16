import { SubscriberPage } from "@/components/newsflow/public-pages";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Unsubscribe",
  "Manage your newsletter subscription preferences.",
);

export default function Page() {
  return <SubscriberPage type="unsubscribe" />;
}
