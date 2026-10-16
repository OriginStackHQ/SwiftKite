import { AuthPage } from "@/components/newsflow/auth";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Reset your password",
  "Request a simulated password reset in NewsFlow.",
);

export default function Page() {
  return <AuthPage mode="forgot" />;
}
