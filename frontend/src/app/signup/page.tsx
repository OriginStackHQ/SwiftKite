import { AuthPage } from "@/components/newsflow/auth";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Create your account",
  "Start your next newsletter chapter with NewsFlow.",
);

export default function Page() {
  return <AuthPage mode="signup" />;
}
