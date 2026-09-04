"use client";

import { useEffect } from "react";

import { IconoCruz, IconoFlecha } from "./iconos";
import { Reproductor } from "./reproductor";

/**
 * El visor de videos, a pantalla completa y con la voz de la marca.
 *
 * No es el visor de fotos con un video adentro. Un video se mira distinto: se
 * le da tiempo, se lee de qué se trata antes o después, y se pasa al siguiente
 * cuando termina. Por eso acá el reproductor viene acompañado del título y la
 * descripción que Halley le cargó, y del contador de en cuál se está.
 *
 * El reproductor es el propio del sitio, el de la barra recta y los controles
 * en blanco: los controles nativos los dibuja cada navegador a su manera y
 * rompen el tono. Lo que se suma alrededor sigue la misma gramática, líneas de
 * un píxel en blanco atenuado sobre negro, rótulos en versalitas, nada
 * redondeado.
 */

export type VideoVisor = {
  id: string;
  url: string;
  titulo?: string | null;
  descripcion?: string | null;
};

export function VisorVideo({
  videos,
  indice,
  alCambiar,
  alCerrar,
}: {
  videos: VideoVisor[];
  /** Cuál se ve, o `null` si está cerrado. */
  indice: number | null;
  alCambiar: (i: number) => void;
  alCerrar: () => void;
}) {
  const abierto = indice !== null;

  useEffect(() => {
    if (!abierto) return;

    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
      if (e.key === "ArrowRight" && indice! < videos.length - 1) {
        alCambiar(indice! + 1);
      }
      if (e.key === "ArrowLeft" && indice! > 0) alCambiar(indice! - 1);
    };
    document.addEventListener("keydown", tecla);

    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = previo;
    };
  }, [abierto, indice, videos.length, alCambiar, alCerrar]);

  if (indice === null) return null;
  const video = videos[indice];
  if (!video) return null;

  const hayAnterior = indice > 0;
  const haySiguiente = indice < videos.length - 1;

  return (
    <div
      onClick={alCerrar}
      className="lightbox-fondo fixed inset-0 z-[70] flex flex-col bg-[rgb(0_0_0/0.94)] text-white"
    >
      {/* La cabecera: dónde se está y cómo salir. Detiene el clic para que
          tocar el contador no cierre. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-between gap-4 border-b border-white/15 px-5 py-3 sm:px-8"
      >
        <span className="font-rotulo text-[11px] tracking-[0.14em] text-white/60 uppercase">
          Video {indice + 1} de {videos.length}
        </span>
        <button
          type="button"
          onClick={alCerrar}
          aria-label="Cerrar"
          className="grid h-10 w-10 cursor-pointer place-items-center text-white/70 hover:text-white"
        >
          <IconoCruz className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-6 sm:px-20">
        {hayAnterior && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              alCambiar(indice - 1);
            }}
            aria-label="Anterior"
            className="absolute left-3 grid h-12 w-12 rotate-180 cursor-pointer place-items-center border border-white/25 bg-black/50 text-white/70 hover:border-white hover:text-white sm:left-6"
          >
            <IconoFlecha className="h-5 w-5" />
          </button>
        )}

        {haySiguiente && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              alCambiar(indice + 1);
            }}
            aria-label="Siguiente"
            className="absolute right-3 grid h-12 w-12 cursor-pointer place-items-center border border-white/25 bg-black/50 text-white/70 hover:border-white hover:text-white sm:right-6"
          >
            <IconoFlecha className="h-5 w-5" />
          </button>
        )}

        {/* El clic sobre el contenido no cierra: sólo el fondo. */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-full w-full max-w-[1100px] flex-col overflow-y-auto"
        >
          {/* Por `key`: cambiar de video desmonta el reproductor y monta otro,
              así el nuevo arranca solo igual que el primero. Cambiarle el `src`
              al mismo elemento deja al navegador decidir si vuelve a arrancar,
              y no todos lo hacen. */}
          <Reproductor key={video.id} src={video.url} />

          {(video.titulo ?? video.descripcion) && (
            <div className="mt-5 border-t border-white/15 pt-4">
              {video.titulo && (
                <h2 className="font-titulo text-[clamp(1.4rem,3vw,2.2rem)] leading-[0.95] uppercase">
                  {video.titulo}
                </h2>
              )}
              {video.descripcion && (
                <p className="mt-2 max-w-[70ch] text-[14.5px] leading-relaxed text-white/70">
                  {video.descripcion}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
