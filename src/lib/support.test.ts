import { describe, expect, it } from "vitest";

import { SUPPORT_MESSAGE, SUPPORT_WHATSAPP, supportHref } from "./support";

describe("supportHref", () => {
  it("opens WhatsApp chat with the support number and a prefilled message", () => {
    const url = new URL(supportHref());
    expect(url.origin + url.pathname).toBe("https://wa.me/5493549503747");
    expect(url.searchParams.get("text")).toBe(SUPPORT_MESSAGE);
  });

  it("keeps the number as digits only, as wa.me requires", () => {
    expect(SUPPORT_WHATSAPP).toMatch(/^\d{10,15}$/);
  });
});
