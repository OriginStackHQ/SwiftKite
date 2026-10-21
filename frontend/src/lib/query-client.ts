import { QueryClient } from "@tanstack/react-query";

/**
 * Query defaults mirroring the Ankuram frontend: one request per action, no
 * focus refetches, and no retry storm when the API is down.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 0,
        refetchOnWindowFocus: false,
        retryOnMount: false,
      },
    },
  });
}
