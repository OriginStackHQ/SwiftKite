import { SettingsPage } from "@/components/newsflow/settings";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Settings",
  "Personalize your NewsFlow account, appearance and notifications.",
);

export default function Page() {
  return <SettingsPage />;
}
