"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppLoader } from "@/components/ui/app-loader";
import { useAuth } from "@/lib/auth";

/**
 * Client-side gate for the dashboard. Server-side authorization still lives on
 * every API call — this only keeps the shell from rendering for signed-out users.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/sign-in");
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <AppLoader />;
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
