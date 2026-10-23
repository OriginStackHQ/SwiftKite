import { Suspense } from "react";

import { AppLoader } from "@/components/ui/app-loader";
import { pageMetadata } from "@/lib/seo";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = pageMetadata(
  "Reset your password",
  "Choose a new password for your SwiftKite account.",
);

export default function Page() {
  return (
    <Suspense fallback={<AppLoader />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
