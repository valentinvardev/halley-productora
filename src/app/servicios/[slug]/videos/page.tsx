import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EditorLanding } from "~/app/_components/editor-landing";
import { FUENTES_MARCA } from "~/app/_components/fuentes";
import { GaleriaVideos } from "~/app/_components/galeria-videos";
import { IconoFlecha, IconoVolver } from "~/app/_components/iconos";
import { Logotipo } from "~/app/_components/logotipo";
import { NavPublica } from "~/app/_components/nav-publica";
import { SERVICIOS, servicioPorSlug } from "~/app/_datos/servicios";
import { COOKIE_ADMIN, cookieValida } from "~/server/auth";
import { contenidoDe } from "~/server/contenido";
import {
  BLOQUE_DE_SERVICIO,
  esSlugServicio,
  textosDeBloque,
} from "~/server/textos-sitio";

/**
 * Los videos de un servicio, en página propia.
 *
 * Es una subpágina y no una sección más de la página del servicio porque un
 * video pide otro ritmo que una foto: se le da tiempo, se lee de qué se trata,
 * se pasa al siguiente. Mezclado con la galería de fotos quedaba como un
 * apéndice al pie. Acá cada video tiene su cuadro, su título y su descripción,
 * y el visor a pantalla completa los recorre de a uno.
 *
 * Lo que se muestra sale de lo mismo que la galería: las piezas que Halley
 * sube a la categoría desde el panel, filtrando las que son video. El título y
 * la descripción también se cargan desde ahí, pieza por pieza.
 */

/** Se lee el contenido en cada visita: lo que sube el admin aparece al toque. */
export const dynamic = "force-dynamic";

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
    title: `Videos de ${servicio.nombre.toLowerCase()} — Halley Audiovisual`,
    description: `Lo que grabamos en ${servicio.nombre.toLowerCase()}: cada video con su título y de qué se trata, para mirar a pantalla completa.`,
  };
}

export default async function VideosServicioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const { slug } = await params;
  const servicio = servicioPorSlug(slug);
  if (!servicio || !esSlugServicio(slug)) notFound();

  const bloque = BLOQUE_DE_SERVICIO[slug];
  const t = await textosDeBloque(bloque);

  // Mismo trato que la página del servicio: `?editar=1` y además ser
  // administrador. Los textos de arriba son dos campos más del mismo bloque.
  const { editar } = await searchParams;
  const galleta = await cookies();
  const editando =
    editar === "1" && cookieValida(galleta.get(COOKIE_ADMIN)?.value);
  const e = (campo: string) =>
    editando ? { "data-texto": `${bloque}.${campo}` } : {};

  const contenido = await contenidoDe(slug);
  const videos = contenido.filter((p) => p.tipo === "video");
  const otros = SERVICIOS.filter((s) => s.slug !== servicio.slug);

  return (
    <div className={`landing ${FUENTES_MARCA}`}>
      {editando && <EditorLanding />}
      <NavPublica
        secciones={[
          { href: "/#servicios", texto: "Servicios" },
          { href: "/#como", texto: "Cómo trabajamos" },
          { href: "/#contacto", texto: "Contacto" },
        ]}
      />

      {/* ---------------------------------------------------------- titular */}
      <section className="border-b border-gray-20">
        <div className="mx-auto max-w-[1140px] px-6 pt-12 pb-16 sm:px-10 sm:pt-16 sm:pb-20">
          <Link
            href={`/servicios/${servicio.slug}`}
            className="inline-flex items-center gap-2 font-rotulo text-[11.5px] tracking-[0.14em] text-gray-45 uppercase hover:text-ink"
          >
            <IconoVolver className="h-3 w-3" />
            {t.nombre}
          </Link>

          <p className="mt-8 font-rotulo text-[12.5px] tracking-[0.22em] text-gray-70 uppercase">
            Videos
          </p>
          <h1
            {...e("videosTitulo")}
            className="mt-4 max-w-[16ch] font-titulo text-[clamp(2.4rem,7vw,5rem)] leading-[0.9] uppercase"
          >
            {t.videosTitulo}
          </h1>
          <p
            {...e("videosBajada")}
            className="mt-7 max-w-[56ch] text-[16px] leading-relaxed text-gray-70"
          >
            {t.videosBajada}
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------- videos */}
      <section className="border-b border-gray-20">
        <div className="mx-auto max-w-[1140px] px-6 py-16 sm:px-10 sm:py-20">
          {videos.length > 0 ? (
            <GaleriaVideos videos={videos} />
          ) : (
            <p className="nota max-w-[52ch] text-[14px]">
              Todavía no hay videos de {t.nombre.toLowerCase()}. Lo que grabemos
              aparece acá apenas lo subamos.
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------- los otros */}
      <section className="border-b border-gray-20">
        <div className="mx-auto max-w-[1140px] px-6 py-16 sm:px-10">
          <p className="font-rotulo text-[12.5px] tracking-[0.22em] text-gray-70 uppercase">
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
            <p className="font-rotulo text-[12px] tracking-[0.14em] text-gray-45 uppercase">
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
