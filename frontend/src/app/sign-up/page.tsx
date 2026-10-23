import { AuthPage } from "@/components/swiftkite/auth";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Create your account",
  "Create a SwiftKite account and start sending reliable email campaigns.",
);

export default function Page() {
  return <AuthPage mode="sign-up" />;
}
