import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FUENTES_MARCA } from "~/app/_components/fuentes";
import {
  IconoCalculadora,
  IconoFlecha,
  IconoInstagram,
  IconoSobre,
  IconoVolver,
  IconoWhatsApp,
} from "~/app/_components/iconos";
import { Logotipo } from "~/app/_components/logotipo";
import {
  BarraSeleccion,
  BotonElegirFotos,
  GaleriaPublica,
  ProveedorSeleccion,
} from "~/app/_components/galeria-publica";
import { Medio } from "~/app/_components/medio";
import { NavPublica } from "~/app/_components/nav-publica";
import {
  botonFantasma,
  botonSolido,
  botonWhatsApp,
} from "~/app/_components/ui";
import { eventoDeServicio } from "~/app/_datos/presupuesto";
import { SERVICIOS, consultaDe, servicioPorSlug } from "~/app/_datos/servicios";
import { cookies } from "next/headers";

import { EditorLanding } from "~/app/_components/editor-landing";
import { contacto, linkWhatsApp } from "~/server/ajustes";
import { COOKIE_ADMIN, cookieValida } from "~/server/auth";
import { contenidoDe } from "~/server/contenido";
import {
  BLOQUE_DE_SERVICIO,
  esSlugServicio,
  textosDeBloque,
} from "~/server/textos-sitio";

/**
 * Marca un texto como editable, igual que en la portada: fuera del modo
 * edición no agrega nada al HTML.
 */
function editable(campo: string, editando: boolean) {
  return editando ? { "data-texto": campo } : {};
}

/** Se lee el contenido en cada visita: lo que sube el admin aparece al toque. */
export const dynamic = "force-dynamic";

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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const { slug } = await params;
  const servicio = servicioPorSlug(slug);
  if (!servicio || !esSlugServicio(slug)) notFound();

  const otros = SERVICIOS.filter((s) => s.slug !== servicio.slug);

  // Los textos editados desde el panel, o los de fábrica si no se tocaron.
  const bloque = BLOQUE_DE_SERVICIO[slug];
  const t = await textosDeBloque(bloque);
  const consulta = consultaDe({ ...servicio, nombre: t.nombre });

  // Mismo trato que la portada: `?editar=1` y además ser administrador.
  const { editar } = await searchParams;
  const galleta = await cookies();
  const editando =
    editar === "1" && cookieValida(galleta.get(COOKIE_ADMIN)?.value);
  const e = (campo: string) => editable(`${bloque}.${campo}`, editando);
  // Bodas y quince tienen catálogo de precios y por lo tanto simulador; marcas
  // y egresados se cotizan hablando, y ahí el botón sería una promesa vacía.
  const evento = eventoDeServicio(servicio.slug);

  // El material real que subió el admin. Si no hay, se cae a las muestras.
  const datos = await contacto();
  const contenido = await contenidoDe(servicio.slug);
  // Antes la primera pieza era la portada grande de arriba y la galería
  // arrancaba en la segunda. La portada se fue, así que todo lo subido es
  // galería: sacarla sin este cambio habría hecho desaparecer una foto.
  const galeria = contenido;
  const fotos = galeria.filter((p) => p.tipo === "imagen");
  const videos = galeria.filter((p) => p.tipo === "video");

  return (
    <ProveedorSeleccion>
      <div className={`landing ${FUENTES_MARCA}`}>
        {editando && <EditorLanding />}
        <NavPublica
          secciones={[
            { href: "/#servicios", texto: "Servicios" },
            { href: "/#como", texto: "Cómo trabajamos" },
            { href: `#pedir`, texto: "Contacto" },
          ]}
        />

        {/* ---------------------------------------------------------- titular */}
        <section className="border-b border-gray-20">
          <div className="mx-auto max-w-[1140px] px-6 pt-12 pb-16 sm:px-10 sm:pt-16 sm:pb-20">
            <Link
              href="/#servicios"
              className="inline-flex items-center gap-2 font-rotulo text-[12px] uppercase tracking-[0.14em] text-gray-45 hover:text-ink"
            >
              <IconoVolver className="h-3 w-3" />
              Todos los servicios
            </Link>

            <p
              {...e("nombre")}
              className="mt-10 font-rotulo text-[12.5px] uppercase tracking-[0.22em] text-gray-70"
            >
              {t.nombre}
            </p>
            <h1
              {...e("titular")}
              className="mt-4 max-w-[16ch] font-titulo text-[clamp(2.4rem,7vw,5rem)] leading-[0.9] uppercase"
            >
              {t.titular}
            </h1>
            <p
              {...e("entrada")}
              className="mt-7 max-w-[56ch] text-[16px] leading-relaxed text-gray-70"
            >
              {t.entrada}
            </p>

            <div className="mt-9 flex flex-wrap gap-3.5">
              <BotonElegirFotos hayFotos={fotos.length > 0} />
              {evento && (
                <Link href={`/presupuesto/${evento}`} className={botonSolido}>
                  <IconoCalculadora />
                  Simular presupuesto
                </Link>
              )}
              <a href="#pedir" className={botonFantasma}>
                <IconoFlecha />
                Ver qué incluye
              </a>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- galería */}
        {/* Va apenas debajo del titular, antes que el detalle: quien entra a
          una categoría quiere ver trabajo, no leer una lista. El detalle
          convence después, con la muestra ya vista. */}
        <section className="border-b border-gray-20">
          <div className="mx-auto max-w-[1140px] px-6 py-20 sm:px-10 sm:py-24">
            <h2 className="max-w-[20ch] font-titulo text-[clamp(1.9rem,5vw,3.4rem)] leading-[0.92] uppercase">
              De {t.nombre.toLowerCase()} que ya cubrimos
            </h2>

            <div className="mt-11">
              {galeria.length > 0 ? (
                <GaleriaPublica
                  fotos={fotos}
                  videos={videos}
                  nombre={t.nombre}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: servicio.piezas }, (_, i) => (
                    <Medio
                      key={i}
                      src={`/servicios/${servicio.slug}-${String(i + 1).padStart(2, "0")}.jpg`}
                      alt={`${servicio.nombre} ${i + 1}`}
                      proporcion="aspect-[4/3]"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- incluye */}
        <section className="border-b border-gray-20">
          <div className="mx-auto max-w-[1140px] px-6 py-20 sm:px-10 sm:py-24">
            <h2 className="max-w-[18ch] font-titulo text-[clamp(1.9rem,5vw,3.4rem)] leading-[0.92] uppercase">
              Qué incluye
            </h2>

            <div className="mt-11 grid gap-px border border-gray-20 bg-gray-20 sm:grid-cols-2">
              {([1, 2, 3, 4] as const).map((n) => (
                <div key={n} className="bg-paper p-7 sm:p-9">
                  <h3
                    {...e(`titulo${n}`)}
                    className="font-titulo text-[clamp(1.3rem,2.4vw,1.8rem)] leading-tight uppercase"
                  >
                    {t[`titulo${n}`]}
                  </h3>
                  <p
                    {...e(`texto${n}`)}
                    className="mt-3 max-w-[44ch] text-[14.5px] leading-relaxed text-gray-70"
                  >
                    {t[`texto${n}`]}
                  </p>
                </div>
              ))}
            </div>

            <p {...e("aclaracion")} className="nota mt-7 max-w-[62ch]">
              {t.aclaracion}
            </p>
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
              {t.nombre.toLowerCase()} con todo lo que incluye y el precio.
            </p>

            <div className="mt-9 flex flex-wrap justify-center gap-3.5">
              <a
                href={linkWhatsApp(datos.whatsapp, consulta)}
                target="_blank"
                rel="noreferrer"
                className={botonWhatsApp}
              >
                <IconoWhatsApp />
                Pedir presupuesto
              </a>
              {evento && (
                <Link href={`/presupuesto/${evento}`} className={botonSolido}>
                  <IconoCalculadora />
                  Simularlo yo
                </Link>
              )}
              <a
                href={`mailto:${datos.mail}?subject=${encodeURIComponent(consulta)}`}
                className={botonFantasma}
              >
                <IconoSobre />
                Escribir un mail
              </a>
              <a
                href={datos.instagram}
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
              <Logotipo variante="isologo" className="h-28" />
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

        <BarraSeleccion
          whatsapp={datos.whatsapp}
          categoria={servicio.nombre}
          fotos={fotos}
        />
      </div>
    </ProveedorSeleccion>
  );
}
