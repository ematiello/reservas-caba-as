import { describe, expect, it } from "vitest";

import { fingerprintOf, isExpectedError, routeOf, sanitizeText } from "./sanitize";

describe("sanitizeText", () => {
  it("replaces emails, long digit runs, bearer tokens, JWTs and Supabase keys", () => {
    const text =
      "fail for ana@example.com phone 5493515550000 card 4111 1111 1111 1111 " +
      "Authorization: Bearer abc.def-123 jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig " +
      "key sb_secret_AbCdEf123456 and sb_publishable_ZyXw987654";
    const out = sanitizeText(text, 2000);
    expect(out).not.toMatch(/ana@example\.com/);
    expect(out).not.toMatch(/5493515550000/);
    expect(out).not.toMatch(/4111/);
    expect(out).not.toMatch(/abc\.def-123/);
    expect(out).not.toMatch(/eyJhbGci/);
    expect(out).not.toMatch(/sb_secret_AbCdEf123456/);
    expect(out).not.toMatch(/sb_publishable_ZyXw987654/);
    expect(out).toContain("[email]");
  });

  it("keeps the readable parts and short numbers", () => {
    expect(sanitizeText("Cannot read properties of undefined (reading 'id') at line 42", 500)).toBe(
      "Cannot read properties of undefined (reading 'id') at line 42",
    );
  });

  it("truncates with an ellipsis and trims", () => {
    expect(sanitizeText("  " + "x".repeat(50) + "  ", 20)).toBe("x".repeat(19) + "…");
  });
});

describe("routeOf", () => {
  it("drops the query string and the hash, and turns ids into :id", () => {
    expect(routeOf("/panel/reservas/3f2b1c0e-9d4a-4f6b-8a1c-2b3c4d5e6f70?mes=2026-11#x")).toBe("/panel/reservas/:id");
    expect(routeOf("/admin/organizaciones/3f2b1c0e-9d4a-4f6b-8a1c-2b3c4d5e6f70/reservas")).toBe(
      "/admin/organizaciones/:id/reservas",
    );
  });

  it("falls back to / and caps the length", () => {
    expect(routeOf("")).toBe("/");
    expect(routeOf("/" + "a".repeat(400))).toHaveLength(200);
  });
});

describe("fingerprintOf", () => {
  it("groups the same failure and tells different ones apart", () => {
    const a = fingerprintOf({ source: "server", route: "/panel", message: "Boom 123 for 3f2b1c0e-9d4a-4f6b-8a1c-2b3c4d5e6f70" });
    const same = fingerprintOf({ source: "server", route: "/panel", message: "Boom 456 for 9a8b7c6d-1111-4222-8333-444455556666" });
    expect(same).toBe(a);
    expect(fingerprintOf({ source: "browser", route: "/panel", message: "Boom 123 for x" })).not.toBe(a);
    expect(fingerprintOf({ source: "server", route: "/admin", message: "Boom 123 for x" })).not.toBe(a);
    expect(fingerprintOf({ source: "server", route: "/panel", message: "Other" })).not.toBe(a);
  });

  it("prefers the digest, because production replaces the message with a generic one", () => {
    const first = fingerprintOf({ source: "server", route: "/panel", message: "An error occurred in the Server Components render.", digest: "111" });
    const second = fingerprintOf({ source: "server", route: "/panel", message: "An error occurred in the Server Components render.", digest: "222" });
    expect(first).not.toBe(second);
    expect(fingerprintOf({ source: "server", route: "/panel", message: "changed text", digest: "111" })).toBe(first);
  });

  it("is a short hex string", () => {
    expect(fingerprintOf({ source: "server", route: "/", message: "x" })).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("isExpectedError", () => {
  it("ignores the framework's control flow: redirects, not found and dynamic rendering", () => {
    expect(isExpectedError({ digest: "NEXT_REDIRECT;replace;/panel;307;" })).toBe(true);
    expect(isExpectedError({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" })).toBe(true);
    expect(isExpectedError({ digest: "NEXT_NOT_FOUND" })).toBe(true);
    expect(isExpectedError({ digest: "DYNAMIC_SERVER_USAGE" })).toBe(true);
    expect(isExpectedError(new Error("Dynamic server usage: Route /x couldn't be rendered statically"))).toBe(true);
  });

  it("does not ignore real failures", () => {
    expect(isExpectedError(new Error("Could not load the booking"))).toBe(false);
    expect(isExpectedError({ digest: "1234567890" })).toBe(false);
    expect(isExpectedError("boom")).toBe(false);
    expect(isExpectedError(null)).toBe(false);
  });
});
