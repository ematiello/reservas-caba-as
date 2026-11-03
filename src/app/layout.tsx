import type { Metadata, Viewport } from "next";
import { Lato, Montserrat } from "next/font/google";

import { BRAND_GREEN_DEEP } from "@/components/brand/colors";

import "./globals.css";

// Brand type from "Identidad serrana: Reservas Traslasierra" for the whole app (public pages,
// panel, admin and sign-in): Montserrat for headings, Lato for text.
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-lato", display: "swap" });

// Brand name and domain are still pending (docs/05-decisiones.md); keep the site out of
// search indexes until launch.
export const metadata: Metadata = {
  title: "Reservas de alojamientos",
  description: "Gestión de reservas para cabañas, casas, departamentos y pequeños hoteles.",
  robots: { index: false, follow: false },
  // Installed from the home screen it opens without browser chrome (see also app/manifest.ts).
  appleWebApp: { capable: true, title: "Reservas Traslasierra", statusBarStyle: "default" },
};

// `viewportFit: "cover"` lets the page use the whole screen on phones with a notch; the shell
// pads itself with env(safe-area-inset-*), so nothing ends up under it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: BRAND_GREEN_DEEP,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${montserrat.variable} ${lato.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
