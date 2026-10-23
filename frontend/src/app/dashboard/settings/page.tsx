import { SettingsPage } from "@/components/swiftkite/settings";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Settings",
  "Manage your SwiftKite profile and security.",
);

export default function Page() {
  return <SettingsPage />;
}
