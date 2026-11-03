import "server-only";

import { headers } from "next/headers";

import { resolveSiteOrigin } from "./site-origin";

// Public origin of the site, used to build absolute links (confirmation and invitation emails).
export async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const production = process.env.NODE_ENV === "production";
  if (configured) return resolveSiteOrigin({ configured, production, host: null, forwardedProto: null });
  const h = await headers();
  return resolveSiteOrigin({
    configured,
    production,
    host: h.get("host"),
    forwardedProto: h.get("x-forwarded-proto"),
  });
}
