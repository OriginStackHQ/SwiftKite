import { AuthPage } from "@/components/swiftkite/auth";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Sign in", "Sign in to your SwiftKite workspace.");

export default function Page() {
  return <AuthPage mode="sign-in" />;
}
