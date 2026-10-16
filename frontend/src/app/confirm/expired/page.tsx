import { SubscriberPage } from "@/components/newsflow/public-pages";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Confirmation expired",
  "Your newsletter subscription confirmation link has expired.",
);

export default function Page() {
  return <SubscriberPage type="expired" />;
}
