import { describe, expect, it } from "vitest";

import { resultUrl } from "./action-result-url";

describe("resultUrl", () => {
  it("appends the ok or error code the page turns into a message", () => {
    expect(resultUrl("/panel/feriados", { ok: "feriado" })).toBe("/panel/feriados?ok=feriado");
    expect(resultUrl("/admin/administradores", { error: "quitar_ultimo" })).toBe("/admin/administradores?error=quitar_ultimo");
  });
});
