import { AuthPage } from "@/components/newsflow/auth";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Forgot password",
  "Request a password reset link for your NewsFlow account.",
);

export default function Page() {
  return <AuthPage mode="forgot" />;
}
