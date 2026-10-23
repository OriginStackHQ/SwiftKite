import type { Metadata } from "next";

export function pageMetadata(title: string, description: string): Metadata {
  const fullTitle = `${title} · SwiftKite`;
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
