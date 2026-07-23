"use client";

import { useEffect } from "react";

import { IconoCruz, IconoFlecha } from "~/app/_components/iconos";

export type PiezaLightbox = {
  id: string;
  url: string;
  tipo: "imagen" | "video";
};

/**
 * El visor a pantalla completa.
 *
 * Se abre al tocar una pieza de la galería. Flechas y teclado para pasar,
 * Escape o clic en el fondo para cerrar. El índice lo maneja quien lo abre, así
 * el recorrido es sobre la misma lista que se está viendo.
 */
export function Lightbox({
  piezas,
  indice,
  alCambiar,
  alCerrar,
}: {
  piezas: PiezaLightbox[];
  /** Cuál se ve, o null si está cerrado. */
  indice: number | null;
  alCambiar: (i: number) => void;
  alCerrar: () => void;
}) {
  const abierto = indice !== null;

  useEffect(() => {
    if (!abierto) return;

    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
      if (e.key === "ArrowRight" && indice! < piezas.length - 1)
        alCambiar(indice! + 1);
      if (e.key === "ArrowLeft" && indice! > 0) alCambiar(indice! - 1);
    };
    document.addEventListener("keydown", tecla);

    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = previo;
    };
  }, [abierto, indice, piezas.length, alCambiar, alCerrar]);

  if (indice === null) return null;
  const pieza = piezas[indice];
  if (!pieza) return null;

  return (
    <div
      onClick={alCerrar}
      className="lightbox-fondo fixed inset-0 z-[70] flex items-center justify-center bg-[rgb(0_0_0/0.9)] p-4"
    >
      <button
        type="button"
        onClick={alCerrar}
        aria-label="Cerrar"
        className="absolute top-4 right-4 grid h-10 w-10 place-items-center text-white/70 hover:text-white"
      >
        <IconoCruz className="h-5 w-5" />
      </button>

      <span className="absolute top-5 left-5 font-rotulo text-[12px] uppercase tracking-[0.1em] text-white/70">
        {indice + 1} / {piezas.length}
      </span>

      {indice > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            alCambiar(indice - 1);
          }}
          aria-label="Anterior"
          className="absolute left-3 grid h-12 w-12 rotate-180 place-items-center text-white/70 hover:text-white sm:left-6"
        >
          <IconoFlecha className="h-6 w-6" />
        </button>
      )}

      {indice < piezas.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            alCambiar(indice + 1);
          }}
          aria-label="Siguiente"
          className="absolute right-3 grid h-12 w-12 place-items-center text-white/70 hover:text-white sm:right-6"
        >
          <IconoFlecha className="h-6 w-6" />
        </button>
      )}

      {/* El clic sobre el contenido no cierra: sólo el fondo. */}
      <div onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full">
        {pieza.tipo === "video" ? (
          <video
            src={pieza.url}
            controls
            autoPlay
            className="max-h-[88vh] max-w-full"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pieza.url}
            alt=""
            className="max-h-[88vh] max-w-full object-contain"
          />
        )}
      </div>
    </div>
  );
}
