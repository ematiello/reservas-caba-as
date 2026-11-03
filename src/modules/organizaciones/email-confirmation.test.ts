import { describe, expect, it } from "vitest";

import { parseEmailConfirmation } from "./email-confirmation";

const HASH = "pkce_0f3a9c2b7d1e4f5a6b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c";

describe("parseEmailConfirmation", () => {
  it.each(["signup", "email"])("accepts the email-confirmation type %s", (type) => {
    expect(parseEmailConfirmation(HASH, type)).toEqual({ tokenHash: HASH, type });
  });

  it.each(["recovery", "invite", "magiclink", "", null])("rejects the type %s", (type) => {
    expect(parseEmailConfirmation(HASH, type)).toBeNull();
  });

  it.each([null, "", "corto", "con espacios en el medio 1234567890", `${HASH}<script>`, "a".repeat(300)])(
    "rejects the malformed token hash %s",
    (hash) => {
      expect(parseEmailConfirmation(hash, "signup")).toBeNull();
    },
  );
});
