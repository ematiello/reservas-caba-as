import { CalendarCheck, MessageCircle, Mountain, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/brand/logo";
import { Sierras } from "@/components/brand/sierras";
import { listPublicProperties } from "@/modules/publico/queries";
import { BRAND, publicRobots, siteUrl } from "@/modules/publico/seo";

export const metadata: Metadata = {
  title: `${BRAND}: alojamientos en las Sierras de Córdoba`,
  description: "Cabañas, departamentos, hoteles y hosterías en Traslasierra. Consultá fechas y escribile al alojamiento por WhatsApp.",
  robots: publicRobots(),
  metadataBase: siteUrl(),
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: BRAND, locale: "es_AR" },
};

const PROMISES = [
  { icon: ShieldCheck, title: "Alojamientos verificados", text: "Cada negocio se revisa antes de publicarse." },
  { icon: CalendarCheck, title: "Fechas al día", text: "La disponibilidad sale del calendario del alojamiento." },
  { icon: MessageCircle, title: "Atención personalizada", text: "Hablás directo con quien te recibe, por WhatsApp." },
  { icon: Mountain, title: "Viví Traslasierra", text: "Ríos, sierras y pueblos a pocos minutos." },
];

export default async function HomePage() {
  const properties = await listPublicProperties();

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Sierras />
        </div>
        <div className="mx-auto grid min-h-[30rem] max-w-6xl content-start gap-5 px-4 pt-14 pb-56 sm:min-h-[34rem] sm:pt-20">
          <h1 className="font-display max-w-[14ch] text-[clamp(2.6rem,7.5vw,4.75rem)] leading-[0.98] font-extrabold tracking-tight text-brand-green-deep">
            Tu estadía en Traslasierra
          </h1>
          <p className="max-w-[46ch] text-lg leading-relaxed text-brand-slate">
            Cabañas, departamentos, hoteles y hosterías en el corazón de las Sierras de Córdoba.
          </p>
          <div>
            <Link
              href="#alojamientos"
              className="font-display inline-flex rounded-full bg-brand-ochre px-6 py-3 font-semibold text-brand-slate hover:bg-[#d9913a] focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Ver alojamientos
            </Link>
          </div>
        </div>
      </section>

      <section aria-label="Por qué reservar acá" className="bg-brand-sand">
        <ul className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <Icon aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-brand-green" strokeWidth={1.75} />
              <div>
                <p className="font-display font-semibold text-brand-green-deep">{title}</p>
                <p className="text-sm leading-relaxed">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="alojamientos" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-14">
        <h2 className="font-display text-3xl font-bold text-brand-green-deep">Dónde quedarte</h2>
        {properties.length === 0 ? (
          <p className="mt-3 max-w-prose text-muted-foreground">
            Todavía no hay alojamientos publicados. Si tenés uno en la zona, podés ser el primero.
          </p>
        ) : (
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/${p.slug}`}
                  className="group block overflow-hidden rounded-2xl bg-white shadow-[0_1px_0_#e3d6c4] ring-1 ring-[var(--border)] focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:outline-none"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-brand-sand">
                    {p.photo ? (
                      // Photos are resized in the browser before upload; no optimizer (images.unoptimized).
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.photo.url}
                        alt={p.photo.alt}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                      />
                    ) : (
                      <Sierras />
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-display text-lg font-semibold text-brand-green-deep">{p.name}</p>
                    {p.city ? <p className="text-sm text-muted-foreground">{p.city}</p> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-[var(--border)] bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-[auto_1fr] md:items-center">
          <BrandMark className="h-20 w-auto" />
          <div className="grid gap-4">
            <h2 className="font-display text-2xl font-bold text-brand-green-deep">¿Tenés un alojamiento en la zona?</h2>
            <p className="max-w-[60ch] leading-relaxed">
              Llevá el calendario sin reservas superpuestas, cargá tus tarifas y señas, y mostrá tu página con fotos,
              disponibilidad y botón de WhatsApp.
            </p>
            <div>
              <Link
                href="/auth/registro"
                className="font-display inline-flex rounded-full bg-brand-green px-6 py-3 font-semibold text-white hover:bg-brand-green-deep focus-visible:ring-2 focus-visible:ring-brand-ochre focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Publicá tu alojamiento
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
