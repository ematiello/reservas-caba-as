import { mediaPath, type EncodedType } from "./image";

// Upload flow for property and unit photos. The steps are injected so the flow can be tested
// without a browser; the uploader component wires the real ones (canvas, Storage, server action).

export type UploadTarget = { orgId: string; propertyId: string; unitId: string | null };

export type UploadDeps = {
  resize: (file: File) => Promise<{ blob: Blob; type: EncodedType }>;
  store: (path: string, blob: Blob, contentType: EncodedType) => Promise<void>;
  register: (media: { propertyId: string; unitId: string | null; storagePath: string }) => Promise<void>;
  newId: () => string;
};

/** Resizes, stores and registers each file in order. A failed file is counted and skipped. */
export async function uploadPhotos(
  files: File[],
  target: UploadTarget,
  deps: UploadDeps,
  onProgress?: (current: number, total: number) => void,
): Promise<{ total: number; failed: number }> {
  let failed = 0;
  for (const [index, file] of files.entries()) {
    onProgress?.(index + 1, files.length);
    try {
      const { blob, type } = await deps.resize(file);
      const path = mediaPath(target.orgId, target.propertyId, deps.newId(), type);
      await deps.store(path, blob, type);
      await deps.register({ propertyId: target.propertyId, unitId: target.unitId, storagePath: path });
    } catch {
      failed += 1;
    }
  }
  return { total: files.length, failed };
}
