import { describe, expect, it, vi } from "vitest";

import type { PageState, PublicProperty } from "./queries";
import { resolvePublicPage } from "./resolve";

const property = { slug: "arroyo", name: "Cabañas del Arroyo" } as PublicProperty;

function readers(state: PageState, cached: PublicProperty | null = property, fresh: PublicProperty | null = property) {
  return {
    state: vi.fn(async () => state),
    cached: vi.fn(async () => cached),
    fresh: vi.fn(async () => fresh),
  };
}

describe("resolvePublicPage", () => {
  it("never reads the content of an unknown slug, so typed addresses cannot fill the cache", async () => {
    const read = readers("missing");
    await expect(resolvePublicPage("aaaa1", read)).resolves.toEqual({ state: "missing" });
    expect(read.cached).not.toHaveBeenCalled();
    expect(read.fresh).not.toHaveBeenCalled();
  });

  it("shows 'no disponible' for a suspended account even if the content read would fail", async () => {
    const read = {
      ...readers("unavailable"),
      cached: vi.fn(async (): Promise<PublicProperty | null> => {
        throw new Error("Could not read the units");
      }),
    };
    await expect(resolvePublicPage("arroyo", read)).resolves.toEqual({ state: "unavailable" });
    expect(read.cached).not.toHaveBeenCalled();
  });

  it("returns the cached content of a published page without a fresh read", async () => {
    const read = readers("published");
    await expect(resolvePublicPage("arroyo", read)).resolves.toEqual({ state: "published", property });
    expect(read.fresh).not.toHaveBeenCalled();
  });

  it("reads fresh when the cache still holds a miss from before the page went live", async () => {
    const read = readers("published", null);
    await expect(resolvePublicPage("arroyo", read)).resolves.toEqual({ state: "published", property });
    expect(read.fresh).toHaveBeenCalledOnce();
  });

  it("is missing when a published state has no readable content", async () => {
    await expect(resolvePublicPage("arroyo", readers("published", null, null))).resolves.toEqual({ state: "missing" });
  });
});
