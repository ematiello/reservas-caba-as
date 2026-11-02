import type { MetadataRoute } from "next";

import { listPublicProperties } from "@/modules/publico/queries";
import { siteUrl } from "@/modules/publico/seo";

// The home page and every published establishment of an active account.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  if (!base) return [];
  const properties = await listPublicProperties();
  return [
    { url: new URL("/", base).toString(), changeFrequency: "weekly", priority: 1 },
    ...properties.map((p) => ({
      url: new URL(`/${p.slug}`, base).toString(),
      lastModified: new Date(p.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
