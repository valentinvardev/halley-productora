"use client";

import { useEffect, useState } from "react";

import { IconoCruz, IconoFlecha } from "./iconos";

export type AvisoFamilia = {
  id: string;
  titulo: string;
  cuerpo: string;
  fotos: { id: string; nombre: string; url: string }[];
};

/**
 * Lo que la productora le cuenta a la familia: fechas, instrucciones, avisos.
 *
 * Va junto a la cuota y no depende del pago —un aviso es justamente lo que hay
 * que poder leer antes—. Las fotos se ven embebidas y se agrandan al tocarlas.
 */
export function AvisosGrupo({ avisos }: { avisos: AvisoFamilia[] }) {
  if (avisos.length === 0) return null;

  return (
    <div className="grid gap-4">
      {avisos.map((a) => (
        <Aviso key={a.id} aviso={a} />
      ))}
    </div>
  );
}

function Aviso({ aviso }: { aviso: AvisoFamilia }) {
  const [visor, setVisor] = useState<number | null>(null);

  return (
    <article className="border border-ink bg-lienzo px-5 py-4">
      <h3 className="text-[15px] leading-snug">{aviso.titulo}</h3>

      {/* El cuerpo se escribe en un textarea, así que los saltos de línea son
          lo único que hay que respetar: `pre-line` los conserva sin dejar
          entrar HTML de nadie. */}
      <p className="mt-2 text-[13.5px] leading-relaxed whitespace-pre-line text-gray-70">
        {aviso.cuerpo}
      </p>

      {aviso.fotos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {aviso.fotos.map((f, i) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setVisor(i)}
              aria-label={`Ampliar ${f.nombre}`}
              className="aspect-square overflow-hidden border border-gray-20 bg-paper-dim"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.url}
                alt={f.nombre}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.04]"
              />
            </button>
          ))}
        </div>
      )}

      {visor !== null && (
        <Lightbox
          fotos={aviso.fotos}
          indice={visor}
          alCambiar={setVisor}
          alCerrar={() => setVisor(null)}
        />
      )}
    </article>
  );
}

function Lightbox({
  fotos,
  indice,
  alCambiar,
  alCerrar,
}: {
  fotos: { id: string; nombre: string; url: string }[];
  indice: number;
  alCambiar: (i: number) => void;
  alCerrar: () => void;
}) {
  const foto = fotos[indice]!;

  // Las flechas y Escape: mirar fotos sin sacar las manos del teclado.
  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
      if (e.key === "ArrowRight" && indice < fotos.length - 1) alCambiar(indice + 1);
      if (e.key === "ArrowLeft" && indice > 0) alCambiar(indice - 1);
    };
    document.addEventListener("keydown", teclas);
    return () => document.removeEventListener("keydown", teclas);
  }, [indice, fotos.length, alCambiar, alCerrar]);

  return (
    <div
      onClick={alCerrar}
      role="dialog"
      aria-label={foto.nombre}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgb(0_0_0/0.92)] p-4"
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

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={foto.url}
        alt={foto.nombre}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full object-contain"
      />
    </div>
  );
}
