import { AuthPage } from "@/components/swiftkite/auth";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Forgot password",
  "Request a password reset link for your SwiftKite account.",
);

export default function Page() {
  return <AuthPage mode="forgot" />;
}
