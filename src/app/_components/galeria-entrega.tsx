"use client";

import { useState } from "react";

import { guardarFoto, puedeCompartirArchivos } from "./descarga";
import { IconoBajar, IconoCruz, IconoFlecha } from "./iconos";

export type FotoEntrega = {
  id: string;
  nombre: string;
  tipo: "imagen" | "video";
  url: string;
  descarga: string;
};

/**
 * El visor de entrega de la familia.
 *
 * Es lo que ve el padre cuando entra a su galería: una grilla que se adapta del
 * teléfono a la computadora, un visor a pantalla completa para mirar de a una,
 * y descarga —que en iPhone abre el menú para guardar en la galería, no una
 * descarga que ahí no sirve—.
 */
export function GaleriaEntrega({
  titulo,
  fotos,
}: {
  titulo: string;
  fotos: FotoEntrega[];
}) {
  const [visor, setVisor] = useState<number | null>(null);

  if (fotos.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        {titulo ? <h3 className="text-[15px]">{titulo}</h3> : <span />}
        <span className="font-rotulo text-[11px] uppercase tracking-[0.06em] text-gray-45">
          {fotos.length} {fotos.length === 1 ? "archivo" : "archivos"}
        </span>
      </div>

      {/* La grilla: dos columnas en el teléfono, más en pantalla grande. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {fotos.map((f, i) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setVisor(i)}
            className="group relative aspect-square overflow-hidden border border-gray-20 bg-paper-dim"
            aria-label={`Ver ${f.nombre}`}
          >
            {f.tipo === "video" ? (
              <>
                <video
                  src={f.url}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid h-10 w-10 place-items-center border border-white/70 bg-black/45">
                    <svg viewBox="0 0 16 16" className="h-4 w-4 text-white" aria-hidden="true">
                      <path d="M4.5 2.5 L13 8 L4.5 13.5 Z" fill="currentColor" />
                    </svg>
                  </span>
                </span>
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={f.url}
                alt={f.nombre}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            )}
          </button>
        ))}
      </div>

      {visor !== null && (
        <VisorEntrega
          fotos={fotos}
          indice={visor}
          alCambiar={setVisor}
          alCerrar={() => setVisor(null)}
        />
      )}
    </div>
  );
}

function VisorEntrega({
  fotos,
  indice,
  alCambiar,
  alCerrar,
}: {
  fotos: FotoEntrega[];
  indice: number;
  alCambiar: (i: number) => void;
  alCerrar: () => void;
}) {
  const foto = fotos[indice]!;
  const [estado, setEstado] = useState<"listo" | "guardando" | "ok">("listo");
  const guardarEs = puedeCompartirArchivos() ? "Guardar" : "Descargar";

  const guardar = async () => {
    setEstado("guardando");
    try {
      await guardarFoto(foto.url, foto.descarga, foto.nombre);
      setEstado("ok");
      setTimeout(() => setEstado("listo"), 1800);
    } catch {
      setEstado("listo");
    }
  };

  return (
    <div
      onClick={alCerrar}
      className="lightbox-fondo fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[rgb(0_0_0/0.92)] p-4"
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
        {indice + 1} / {fotos.length}
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
      {indice < fotos.length - 1 && (
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

      <div onClick={(e) => e.stopPropagation()} className="max-h-[80vh] max-w-full">
        {foto.tipo === "video" ? (
          <video src={foto.url} controls autoPlay className="max-h-[80vh] max-w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto.url}
            alt={foto.nombre}
            className="max-h-[80vh] max-w-full object-contain"
          />
        )}
      </div>

      {/* La descarga, separada del cierre del fondo. */}
      <div onClick={(e) => e.stopPropagation()} className="mt-4">
        <button
          type="button"
          onClick={guardar}
          disabled={estado === "guardando"}
          className="inline-flex items-center gap-2 border border-white bg-white px-6 py-3 font-rotulo text-[13px] uppercase tracking-[0.06em] text-black transition-colors hover:bg-transparent hover:text-white disabled:opacity-60"
        >
          <IconoBajar className="h-4 w-4" />
          {estado === "guardando"
            ? "Preparando…"
            : estado === "ok"
              ? "Listo"
              : guardarEs}
        </button>
      </div>
    </div>
  );
}
