import type { PageState, PublicProperty } from "./queries";

export type ResolvedPage =
  | { state: "missing" }
  | { state: "unavailable" }
  | { state: "published"; property: PublicProperty };

export type PageReaders = {
  /** Live state (never cached): published, unavailable (suspended account) or missing. */
  state: (slug: string) => Promise<PageState>;
  /** Cached content of a published property; null on a cache miss. */
  cached: (slug: string) => Promise<PublicProperty | null>;
  /** Uncached content read, for a page that went live after the cache stored a miss. */
  fresh: (slug: string) => Promise<PublicProperty | null>;
};

/**
 * What `/{slug}` shows. The content is read only after the live state says "published": unknown
 * slugs never reach the content cache (it cannot be filled with typed addresses), and a suspended
 * account shows "no disponible" even when the content read would fail (invariant 6).
 */
export async function resolvePublicPage(slug: string, read: PageReaders): Promise<ResolvedPage> {
  const state = await read.state(slug);
  if (state !== "published") return { state };
  const property = (await read.cached(slug)) ?? (await read.fresh(slug));
  return property ? { state, property } : { state: "missing" };
}
