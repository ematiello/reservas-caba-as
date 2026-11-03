import { afterEach, describe, expect, it, vi } from "vitest";

import { publicMediaUrl } from "./media-url";

afterEach(() => vi.unstubAllEnvs());

describe("publicMediaUrl", () => {
  it("builds the public Storage URL from the project URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co/");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
    expect(publicMediaUrl("org/prop/file.webp")).toBe("https://abc.supabase.co/storage/v1/object/public/media/org/prop/file.webp");
  });

  it("fails loudly instead of building undefined/storage/... when the URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => publicMediaUrl("org/prop/file.webp")).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
