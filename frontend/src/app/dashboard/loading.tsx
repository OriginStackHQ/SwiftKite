import { PageSkeleton } from "@/components/newsflow/ui";

/**
 * Instant loading UI for every dashboard route. Shown during client-side
 * transitions and while streaming content resolves — once the Spring Boot
 * API is wired in, wrap data reads in `<Suspense>` and this renders
 * automatically instead of blocking the navigation.
 */
export default function Loading() {
  return <PageSkeleton />;
}
