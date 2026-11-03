import type { MetadataRoute } from "next";

import { BRAND_GREEN_DEEP, BRAND_PAPER } from "@/components/brand/colors";

// Makes the site installable ("Agregar a la pantalla de inicio"). No service worker on purpose:
// there is no offline mode, and Chrome no longer requires one to offer the install.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Reservas Traslasierra",
    short_name: "Traslasierra",
    description: "Reservas de cabañas, casas, departamentos y pequeños hoteles.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BRAND_PAPER,
    theme_color: BRAND_GREEN_DEEP,
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
