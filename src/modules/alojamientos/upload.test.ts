import { describe, expect, it, vi } from "vitest";

import { isMediaPath } from "./image";
import { uploadPhotos, type UploadDeps } from "./upload";

const ORG = "11111111-1111-4111-8111-111111111111";
const PROP = "22222222-2222-4222-8222-222222222222";
const FILE_ID = "33333333-3333-4333-8333-333333333333";

function deps(overrides: Partial<UploadDeps> = {}): UploadDeps {
  return {
    resize: vi.fn(async () => ({ blob: new Blob(["x"]), type: "image/webp" as const })),
    store: vi.fn(async () => {}),
    register: vi.fn(async () => {}),
    newId: () => FILE_ID,
    ...overrides,
  };
}

const file = (name: string) => new File(["x"], name, { type: "image/png" });

describe("uploadPhotos", () => {
  it("resizes, stores under {org}/{property}/ and registers each file, reporting progress", async () => {
    const d = deps();
    const progress: number[] = [];
    const result = await uploadPhotos([file("a.png"), file("b.png")], { orgId: ORG, propertyId: PROP, unitId: null }, d, (i) =>
      progress.push(i),
    );
    expect(result).toEqual({ total: 2, failed: 0 });
    expect(progress).toEqual([1, 2]);
    const path = `${ORG}/${PROP}/${FILE_ID}.webp`;
    expect(d.store).toHaveBeenCalledWith(path, expect.any(Blob), "image/webp");
    expect(d.register).toHaveBeenCalledWith({ propertyId: PROP, unitId: null, storagePath: path });
  });

  it("counts a failed file and keeps going with the rest", async () => {
    const store = vi.fn().mockRejectedValueOnce(new Error("denied")).mockResolvedValue(undefined);
    const d = deps({ store });
    const result = await uploadPhotos([file("a.png"), file("b.png")], { orgId: ORG, propertyId: PROP, unitId: null }, d);
    expect(result).toEqual({ total: 2, failed: 1 });
    expect(d.register).toHaveBeenCalledTimes(1);
  });

  it("counts a file as failed when its registration fails", async () => {
    const d = deps({ register: vi.fn().mockRejectedValue(new Error("invalid")) });
    const result = await uploadPhotos([file("a.png")], { orgId: ORG, propertyId: PROP, unitId: "u" }, d);
    expect(result).toEqual({ total: 1, failed: 1 });
  });
});

describe("isMediaPath", () => {
  it("accepts only {org}/{property}/{uuid}.webp|jpg", () => {
    expect(isMediaPath(ORG, PROP, `${ORG}/${PROP}/${FILE_ID}.webp`)).toBe(true);
    expect(isMediaPath(ORG, PROP, `${ORG}/${PROP}/${FILE_ID}.jpg`)).toBe(true);
    expect(isMediaPath(ORG, PROP, `${ORG}/${PROP}/../other/${FILE_ID}.jpg`)).toBe(false);
    expect(isMediaPath(ORG, PROP, `${ORG}/${PROP}/sub/${FILE_ID}.jpg`)).toBe(false);
    expect(isMediaPath(ORG, PROP, `${ORG}/${PROP}/${FILE_ID}.png`)).toBe(false);
    expect(isMediaPath(ORG, PROP, `${ORG}/other/${FILE_ID}.webp`)).toBe(false);
  });
});
