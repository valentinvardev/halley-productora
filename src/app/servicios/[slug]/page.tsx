import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bebas_Neue, Montserrat } from "next/font/google";

import {
  IconoFlecha,
  IconoInstagram,
  IconoSobre,
  IconoVolver,
  IconoWhatsApp,
} from "~/app/_components/iconos";
import { Logotipo } from "~/app/_components/logotipo";
import { Medio } from "~/app/_components/medio";
import { NavPublica } from "~/app/_components/nav-publica";
import { botonFantasma, botonSolido } from "~/app/_components/ui";
import {
  INSTAGRAM,
  MAIL,
  SERVICIOS,
  consultaDe,
  linkWhatsApp,
  servicioPorSlug,
} from "~/app/_datos/servicios";

const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-montserrat",
});

/** Son cuatro y no cambian: se generan en el build. */
export function generateStaticParams() {
  return SERVICIOS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const servicio = servicioPorSlug(slug);
  if (!servicio) return {};

  return {
    title: `${servicio.nombre} — Halley Audiovisual`,
    description: servicio.entrada,
  };
}

export default async function ServicioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const servicio = servicioPorSlug(slug);
  if (!servicio) notFound();

  const otros = SERVICIOS.filter((s) => s.slug !== servicio.slug);
  const consulta = consultaDe(servicio);

  return (
    <div className={`landing ${bebas.variable} ${montserrat.variable}`}>
      <NavPublica
        secciones={[
          { href: "/#servicios", texto: "Servicios" },
          { href: "/#como", texto: "Cómo trabajamos" },
          { href: `#pedir`, texto: "Contacto" },
        ]}
      />

      {/* ---------------------------------------------------------- portada */}
      <section className="border-b border-gray-20">
        <div className="mx-auto max-w-[1140px] px-6 pt-12 pb-16 sm:px-10 sm:pt-16 sm:pb-20">
          <Link
            href="/#servicios"
            className="inline-flex items-center gap-2 font-rotulo text-[12px] uppercase tracking-[0.14em] text-gray-45 hover:text-ink"
          >
            <IconoVolver className="h-3 w-3" />
            Todos los servicios
          </Link>

          <p className="mt-10 font-rotulo text-[12.5px] uppercase tracking-[0.22em] text-gray-70">
            {servicio.nombre}
          </p>
          <h1 className="mt-4 max-w-[16ch] font-titulo text-[clamp(2.4rem,7vw,5rem)] leading-[0.9] uppercase">
            {servicio.titular}
          </h1>
          <p className="mt-7 max-w-[56ch] text-[16px] leading-relaxed text-gray-70">
            {servicio.entrada}
          </p>

          <div className="mt-9 flex flex-wrap gap-3.5">
            <a
              href={linkWhatsApp(consulta)}
              target="_blank"
              rel="noreferrer"
              className={botonSolido}
            >
              <IconoWhatsApp />
              Pedir presupuesto
            </a>
            <a href="#pedir" className={botonFantasma}>
              <IconoFlecha />
              Ver qué incluye
            </a>
          </div>
        </div>

        <Medio
          src={`/servicios/${servicio.slug}-portada.jpg`}
          alt={`Portada de ${servicio.nombre}`}
          proporcion="aspect-[21/9]"
          prioridad
        />
      </section>

      {/* ---------------------------------------------------------- incluye */}
      <section className="border-b border-gray-20">
        <div className="mx-auto max-w-[1140px] px-6 py-20 sm:px-10 sm:py-24">
          <h2 className="max-w-[18ch] font-titulo text-[clamp(1.9rem,5vw,3.4rem)] leading-[0.92] uppercase">
            Qué incluye
          </h2>

          <div className="mt-11 grid gap-px border border-gray-20 bg-gray-20 sm:grid-cols-2">
            {servicio.incluye.map((i) => (
              <div key={i.titulo} className="bg-paper p-7 sm:p-9">
                <h3 className="font-titulo text-[clamp(1.3rem,2.4vw,1.8rem)] leading-tight uppercase">
                  {i.titulo}
                </h3>
                <p className="mt-3 max-w-[44ch] text-[14.5px] leading-relaxed text-gray-70">
                  {i.texto}
                </p>
              </div>
            ))}
          </div>

          <p className="nota mt-7 max-w-[62ch]">{servicio.aclaracion}</p>
        </div>
      </section>

      {/* ---------------------------------------------------------- galería */}
      <section className="border-b border-gray-20">
        <div className="mx-auto max-w-[1140px] px-6 py-20 sm:px-10 sm:py-24">
          <h2 className="max-w-[20ch] font-titulo text-[clamp(1.9rem,5vw,3.4rem)] leading-[0.92] uppercase">
            De {servicio.nombre.toLowerCase()} que ya cubrimos
          </h2>

          <div className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: servicio.piezas }, (_, i) => (
              <Medio
                key={i}
                src={`/servicios/${servicio.slug}-${String(i + 1).padStart(2, "0")}.jpg`}
                alt={`${servicio.nombre} ${i + 1}`}
                proporcion="aspect-[4/3]"
              />
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- CTA */}
      <section id="pedir" className="border-b border-gray-20 bg-paper-dimmer">
        <div className="mx-auto max-w-[1140px] px-6 py-20 text-center sm:px-10 sm:py-28">
          <h2 className="mx-auto max-w-[18ch] font-titulo text-[clamp(2.2rem,6.5vw,4.6rem)] leading-[0.9] uppercase">
            ¿Ya tenés fecha?
          </h2>
          <p className="mx-auto mt-6 max-w-[46ch] text-[15.5px] leading-relaxed text-gray-70">
            Contanos el día y dónde es. Te mandamos la propuesta de{" "}
            {servicio.nombre.toLowerCase()} con todo lo que incluye y el precio.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3.5">
            <a
              href={linkWhatsApp(consulta)}
              target="_blank"
              rel="noreferrer"
              className={botonSolido}
            >
              <IconoWhatsApp />
              Pedir presupuesto
            </a>
            <a href={`mailto:${MAIL}?subject=${encodeURIComponent(consulta)}`} className={botonFantasma}>
              <IconoSobre />
              Escribir un mail
            </a>
            <a
              href={INSTAGRAM}
              target="_blank"
              rel="noreferrer"
              className={botonFantasma}
            >
              <IconoInstagram />
              Ver el Instagram
            </a>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- los otros */}
      <section className="border-b border-gray-20">
        <div className="mx-auto max-w-[1140px] px-6 py-16 sm:px-10">
          <p className="font-rotulo text-[12.5px] uppercase tracking-[0.22em] text-gray-70">
            También cubrimos
          </p>
          <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
            {otros.map((o) => (
              <Link
                key={o.slug}
                href={`/servicios/${o.slug}`}
                className="group inline-flex items-baseline gap-3"
              >
                <span className="font-titulo text-[clamp(1.6rem,4vw,2.6rem)] uppercase group-hover:text-gray-70">
                  {o.nombre}
                </span>
                <IconoFlecha className="h-3 w-3 text-gray-45" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-[1140px] px-6 py-12 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <Link href="/" aria-label="Halley Audiovisual">
            <Logotipo variante="isologo" className="h-20" />
          </Link>
          <div className="text-right">
            <p className="font-rotulo text-[12px] uppercase tracking-[0.14em] text-gray-45">
              Halley Audiovisual · Córdoba, Argentina
            </p>
            <p className="mt-2 font-mono text-[10.5px] tracking-[0.1em] text-gray-45">
              HALLEY × SURCODIA — 026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
