import { ImageResponse } from "next/og";

import { AppIconArt } from "@/components/brand/app-icon";

// Icons listed in app/manifest.ts. A route handler (not the `icon` file convention) keeps their
// URLs fixed, so the manifest can point at them. Prerendered at build time.
const ICONS: Record<string, number> = { "192": 192, "512": 512, maskable: 512 };

export function generateStaticParams() {
  return Object.keys(ICONS).map((size) => ({ size }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const side = Object.hasOwn(ICONS, size) ? ICONS[size] : null;
  if (side === null) return new Response(null, { status: 404 });
  return new ImageResponse(<AppIconArt size={side} />, { width: side, height: side });
}
