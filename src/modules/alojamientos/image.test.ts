import { describe, expect, it } from "vitest";

import { fitWithin, mediaPath } from "./image";

describe("fitWithin", () => {
  it("keeps images that already fit", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("scales the longest side down to the limit, keeping the aspect ratio", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("rounds to whole pixels and never returns zero", () => {
    expect(fitWithin(5000, 1, 1600)).toEqual({ width: 1600, height: 1 });
    expect(fitWithin(1601, 999, 1600)).toEqual({ width: 1600, height: 998 });
  });
});

describe("mediaPath", () => {
  it("builds {org}/{property}/{file} with the extension of the encoded type", () => {
    expect(mediaPath("org-1", "prop-2", "abc", "image/webp")).toBe("org-1/prop-2/abc.webp");
    expect(mediaPath("org-1", "prop-2", "abc", "image/jpeg")).toBe("org-1/prop-2/abc.jpg");
  });
});
