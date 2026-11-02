import type { Metadata } from "next";
import { Lato, Montserrat } from "next/font/google";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${montserrat.variable} ${lato.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
