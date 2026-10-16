import type { Metadata } from "next";

/** Builds the per-route metadata that the original TanStack `head()` helper produced. */
export function pageMetadata(title: string, description: string): Metadata {
  const fullTitle = `${title} · NewsFlow`;
  return {
    title: fullTitle,
    description,
    openGraph: {
      title: fullTitle,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}
