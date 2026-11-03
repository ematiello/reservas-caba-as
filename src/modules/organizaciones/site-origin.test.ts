import { describe, expect, it } from "vitest";

import { resolveSiteOrigin } from "./site-origin";

const base = { production: true, host: "atacante.example", forwardedProto: "https" };

describe("resolveSiteOrigin", () => {
  it("uses NEXT_PUBLIC_SITE_URL and ignores the Host header", () => {
    expect(resolveSiteOrigin({ ...base, configured: "https://reservas.example/" })).toBe("https://reservas.example");
    expect(resolveSiteOrigin({ ...base, configured: "https://reservas.example/algo?x=1" })).toBe(
      "https://reservas.example",
    );
  });

  it("rejects a configured value that is not an http(s) URL", () => {
    expect(() => resolveSiteOrigin({ ...base, configured: "reservas.example" })).toThrow(/NEXT_PUBLIC_SITE_URL/);
    expect(() => resolveSiteOrigin({ ...base, configured: "javascript:alert(1)" })).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("never trusts the Host header in production without the variable", () => {
    expect(() => resolveSiteOrigin({ ...base, configured: undefined })).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("allows localhost in production (local standalone server and e2e)", () => {
    expect(resolveSiteOrigin({ ...base, configured: undefined, host: "localhost:3100", forwardedProto: null })).toBe(
      "http://localhost:3100",
    );
    expect(resolveSiteOrigin({ ...base, configured: "", host: "127.0.0.1:3000", forwardedProto: null })).toBe(
      "http://127.0.0.1:3000",
    );
  });

  it("falls back to the Host header in development", () => {
    expect(
      resolveSiteOrigin({ production: false, configured: undefined, host: "192.168.0.10:3000", forwardedProto: null }),
    ).toBe("https://192.168.0.10:3000");
  });

  it("fails without a variable and without a Host header", () => {
    expect(() => resolveSiteOrigin({ production: false, configured: undefined, host: null, forwardedProto: null })).toThrow(
      /NEXT_PUBLIC_SITE_URL/,
    );
  });
});
