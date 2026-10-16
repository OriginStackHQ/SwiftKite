import { AuthPage } from "@/components/newsflow/auth";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Welcome back",
  "Sign in to the NewsFlow demo workspace.",
);

export default function Page() {
  return <AuthPage mode="login" />;
}
