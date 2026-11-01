// Photos are resized in the browser before upload (CLAUDE.md): never stored at full size.

export const MAX_SIDE = 1600;
export const QUALITY = 0.8;

export type EncodedType = "image/webp" | "image/jpeg";

/** Dimensions scaled so the longest side is at most `max`, keeping the aspect ratio. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Object name inside the "media" bucket; the Storage policies check the first two segments. */
export function mediaPath(orgId: string, propertyId: string, fileId: string, type: EncodedType): string {
  return `${orgId}/${propertyId}/${fileId}.${type === "image/webp" ? "webp" : "jpg"}`;
}

const FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$/;

/** True only for a path built by `mediaPath` for this organization and property. */
export function isMediaPath(orgId: string, propertyId: string, path: string): boolean {
  const prefix = `${orgId}/${propertyId}/`;
  return path.startsWith(prefix) && FILE_NAME.test(path.slice(prefix.length));
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/** Browser only. Resizes and re-encodes as WebP, or JPEG where WebP encoding is unsupported (Safari). */
export async function resizeImage(file: File): Promise<{ blob: Blob; type: EncodedType }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not available");
    ctx.drawImage(bitmap, 0, 0, width, height);
  } finally {
    bitmap.close();
  }

  const webp = await toBlob(canvas, "image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, type: "image/webp" };
  const jpeg = await toBlob(canvas, "image/jpeg");
  if (!jpeg) throw new Error("Could not encode the image");
  return { blob: jpeg, type: "image/jpeg" };
}
