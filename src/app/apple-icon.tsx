import { ImageResponse } from "next/og";

import { AppIconArt } from "@/components/brand/app-icon";

// Icon iOS uses when the site is added to the home screen. It must be opaque (no transparency).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIconArt size={size.width} />, { ...size });
}
