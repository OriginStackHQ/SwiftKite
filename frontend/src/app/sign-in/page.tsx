import { AuthPage } from "@/components/newsflow/auth";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Sign in",
  "Sign in to your NewsFlow workspace.",
);

export default function Page() {
  return <AuthPage mode="sign-in" />;
}
