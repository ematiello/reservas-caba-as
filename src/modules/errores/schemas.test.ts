import { describe, expect, it } from "vitest";

import { browserReportSchema } from "./schemas";

describe("browserReportSchema", () => {
  it("accepts a bounded report", () => {
    expect(browserReportSchema.safeParse({ message: "Boom", digest: "123", route: "/panel" }).success).toBe(true);
    expect(browserReportSchema.safeParse({ message: "Boom", route: "/" }).success).toBe(true);
  });

  it("rejects empty, oversized or non-path input", () => {
    expect(browserReportSchema.safeParse({ message: "", route: "/" }).success).toBe(false);
    expect(browserReportSchema.safeParse({ message: "x".repeat(501), route: "/" }).success).toBe(false);
    expect(browserReportSchema.safeParse({ message: "x", digest: "d".repeat(101), route: "/" }).success).toBe(false);
    expect(browserReportSchema.safeParse({ message: "x", route: "https://evil.example" }).success).toBe(false);
    expect(browserReportSchema.safeParse({ message: "x", route: "/" + "a".repeat(200) }).success).toBe(false);
  });
});
