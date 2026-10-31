import "server-only";

import { headers } from "next/headers";

// Public origin of the site, used to build absolute links (confirmation and invitation emails).
export async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("host");
  // Without a configured site URL and a Host header there is no safe origin to put in an email link.
  if (!host) throw new Error("Cannot determine the site origin: set NEXT_PUBLIC_SITE_URL");
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}
