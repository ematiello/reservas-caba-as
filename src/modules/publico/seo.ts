import type { Metadata } from "next";

// The brand's domain is not live yet (layout.tsx keeps the site out of indexes). Public pages turn
// indexable only when the deployment sets SITE_INDEXING=on; robots.ts follows the same switch.
export function siteIndexable(): boolean {
  return process.env.SITE_INDEXING === "on";
}

export function publicRobots(): Metadata["robots"] {
  return siteIndexable() ? { index: true, follow: true } : { index: false, follow: false };
}

/** Absolute base for canonical URLs and the sitemap; undefined when NEXT_PUBLIC_SITE_URL is not set. */
export function siteUrl(): URL | undefined {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  return configured ? new URL(configured) : undefined;
}

export const BRAND = "Reservas Traslasierra";
