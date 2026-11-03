// Public URL of a photo in the `media` bucket. Usable on the server and in the browser
// (NEXT_PUBLIC_SUPABASE_URL is inlined at build time).
export function publicMediaUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL (see .env.example).");
  return `${base}/storage/v1/object/public/media/${storagePath}`;
}
