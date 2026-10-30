import { afterEach, describe, expect, it, vi } from "vitest";

import { getSupabasePublicEnv } from "./env";

describe("getSupabasePublicEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns the public URL and publishable key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");

    expect(getSupabasePublicEnv()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
    });
  });

  it("fails fast when a variable is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(() => getSupabasePublicEnv()).toThrow(/Missing/);
  });
});
