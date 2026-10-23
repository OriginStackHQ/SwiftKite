import { Landing } from "@/components/swiftkite/landing";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Reliable email campaigns",
  "Create a campaign, add recipients with their own data, and send. SwiftKite tracks every email and never sends twice.",
);

export default function Page() {
  return <Landing />;
}
