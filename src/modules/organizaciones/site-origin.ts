const MISSING = "Cannot determine the site origin: set NEXT_PUBLIC_SITE_URL";
const LOCAL_HOST = /^(localhost|127\.0\.0\.1)(:\d+)?$/;

type Input = {
  configured: string | undefined;
  production: boolean;
  host: string | null;
  forwardedProto: string | null;
};

// Public origin for absolute links (confirmation emails, invitation links). In production the
// Host header is attacker-controlled, so only NEXT_PUBLIC_SITE_URL is trusted; localhost stays
// allowed for the local standalone server and the e2e suite.
export function resolveSiteOrigin({ configured, production, host, forwardedProto }: Input): string {
  if (configured) {
    let url: URL;
    try {
      url = new URL(configured);
    } catch {
      throw new Error(`Invalid NEXT_PUBLIC_SITE_URL: ${configured}`);
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error(`Invalid NEXT_PUBLIC_SITE_URL: ${configured}`);
    }
    return url.origin;
  }
  if (!host) throw new Error(MISSING);
  const isLocal = LOCAL_HOST.test(host);
  if (production && !isLocal) throw new Error(MISSING);
  return `${forwardedProto ?? (isLocal ? "http" : "https")}://${host}`;
}
