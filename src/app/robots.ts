import type { MetadataRoute } from "next";

import { siteIndexable, siteUrl } from "@/modules/publico/seo";

// The panel, the admin, auth and the API are never crawled (docs/02). Until launch
// (SITE_INDEXING=on) the whole site stays out of search engines.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  if (!siteIndexable()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/panel", "/admin", "/auth", "/api"] },
    sitemap: base ? new URL("/sitemap.xml", base).toString() : undefined,
  };
}
