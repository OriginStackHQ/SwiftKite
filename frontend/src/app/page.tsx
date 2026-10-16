import { Landing } from "@/components/newsflow/landing";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "NewsFlow — Your newsletter deserves better",
  "A thoughtful workspace to publish newsletters, grow your audience, and understand what resonates.",
);

export default function Page() {
  return <Landing />;
}
