"use client";

import { useState } from "react";

import { VisorVideo, type VideoVisor } from "./visor-video";

/**
 * La página de videos de un servicio: dos columnas, cada video con su título y
 * su descripción, y un botón de reproducir que no deja dudas de que se toca.
 *
 * Dos columnas y no tres porque un video se mira, no se hojea: a un tercio de
 * pantalla el cuadro es una estampilla y el texto de abajo no entra en un
 * renglón. Con dos, el cuadro tiene el tamaño de una miniatura de YouTube en
 * escritorio y ocupa el ancho entero en el teléfono.
 *
 * El primer cuadro del archivo hace de portada. Los videos no tienen
 * miniatura aparte, y `preload="metadata"` alcanza para que el navegador pinte
 * ese cuadro sin bajar el archivo.
 */
export function GaleriaVideos({ videos }: { videos: VideoVisor[] }) {
  const [visor, setVisor] = useState<number | null>(null);

  return (
    <>
      <div className="grid gap-8 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-12">
        {videos.map((v, i) => (
          <article key={v.id} className="group">
            <button
              type="button"
              onClick={() => setVisor(i)}
              aria-label={`Ver ${v.titulo ?? "el video"}`}
              className="relative block aspect-video w-full cursor-pointer overflow-hidden border border-gray-20 bg-black"
            >
              <video
                src={v.url}
                muted
                playsInline
                disablePictureInPicture
                disableRemotePlayback
                preload="metadata"
                className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
              />

              {/* El botón de reproducir: un cuadrado con borde, como todo en el
                  sitio, que al pasar el cursor se invierte a blanco. El
                  triángulo va lleno y no en trazo porque a este tamaño el trazo
                  se lee como un contorno y no como "play". */}
              <span
                aria-hidden="true"
                className="absolute inset-0 grid place-items-center"
              >
                <span className="grid h-16 w-16 place-items-center border border-white/80 bg-black/45 text-white transition-colors group-hover:bg-white group-hover:text-black">
                  <svg viewBox="0 0 16 16" className="h-6 w-6">
                    <path d="M4.5 2.5 L13 8 L4.5 13.5 Z" fill="currentColor" />
                  </svg>
                </span>
              </span>

              <span className="absolute bottom-3 left-3 font-rotulo text-[10.5px] tracking-[0.14em] text-white/80 uppercase">
                Reproducir
              </span>
            </button>

            <div className="mt-4">
              <h2 className="font-titulo text-[clamp(1.4rem,2.6vw,1.9rem)] leading-tight uppercase">
                {v.titulo ?? `Video ${i + 1}`}
              </h2>
              {v.descripcion && (
                <p className="mt-2 max-w-[52ch] text-[14.5px] leading-relaxed text-gray-70">
                  {v.descripcion}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>

      <VisorVideo
        videos={videos}
        indice={visor}
        alCambiar={setVisor}
        alCerrar={() => setVisor(null)}
      />
    </>
  );
}
