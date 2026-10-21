"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLoader } from "@/components/ui/app-loader";
import { useAuth } from "@/lib/auth";
import { takeLinkToken } from "@/lib/auth-api";

function CallbackContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { exchangeOAuthCode } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = params.get("code");
    const hasError = params.get("error") !== null;
    // Consumed once: a link token must never be replayed by a second render.
    const linkToken = takeLinkToken();

    if (hasError || !code) {
      router.replace("/sign-in?error=oauth_failed");
      return;
    }

    exchangeOAuthCode(code, linkToken ?? undefined)
      .then(() => router.replace("/dashboard"))
      .catch(() => router.replace("/sign-in?error=oauth_failed"));
  }, [params, router, exchangeOAuthCode]);

  return <AppLoader label="Finishing sign-in…" />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AppLoader />}>
      <CallbackContent />
    </Suspense>
  );
}
