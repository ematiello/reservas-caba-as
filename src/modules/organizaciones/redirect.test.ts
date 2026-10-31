import { describe, expect, it } from "vitest";

import { safeNext } from "./redirect";

describe("safeNext", () => {
  it("allows internal /panel and /admin paths, including query strings", () => {
    expect(safeNext("/panel")).toBe("/panel");
    expect(safeNext("/panel/reservas?mes=2026-11")).toBe("/panel/reservas?mes=2026-11");
    expect(safeNext("/admin/organizaciones")).toBe("/admin/organizaciones");
  });

  it("falls back to /panel when missing or empty", () => {
    expect(safeNext(undefined)).toBe("/panel");
    expect(safeNext(null)).toBe("/panel");
    expect(safeNext("")).toBe("/panel");
  });

  it.each([
    "https://evil.example/panel",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/otra-ruta",
    "/panelx",
    "panel",
    "/panel/../../etc",
  ])("rejects the unsafe target %s", (target) => {
    expect(safeNext(target)).toBe("/panel");
  });
});
