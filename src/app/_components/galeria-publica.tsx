"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import { IconoFlecha, IconoWhatsApp } from "./iconos";
import { Lightbox, type PiezaLightbox } from "./lightbox";
import { Marca } from "./marca";
import { botonFantasma, botonWhatsApp } from "./ui";

export type PiezaPublica = PiezaLightbox;

/**
 * Elegir favoritas.
 *
 * El botón de presupuesto y la galería están en dos puntos distintos de la
 * página, así que el modo de selección vive en un contexto: uno lo enciende y
 * la otra lo escucha, sin que la página tenga que ser un solo componente.
 */
type Seleccion = {
  eligiendo: boolean;
  empezar: () => void;
  cancelar: () => void;
  gustaron: Set<string>;
  alternar: (id: string) => void;
};

const Ctx = createContext<Seleccion | null>(null);

function useSeleccion() {
  const c = useContext(Ctx);
  if (!c) throw new Error("Falta ProveedorSeleccion");
  return c;
}

export function ProveedorSeleccion({ children }: { children: ReactNode }) {
  const [eligiendo, setEligiendo] = useState(false);
  const [gustaron, setGustaron] = useState<Set<string>>(new Set());

  const valor: Seleccion = {
    eligiendo,
    empezar: () => setEligiendo(true),
    cancelar: () => {
      setEligiendo(false);
      setGustaron(new Set());
    },
    gustaron,
    alternar: (id) =>
      setGustaron((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** El "pedir presupuesto" de la categoría: enciende el modo de elegir. */
export function BotonElegirFotos({ hayFotos }: { hayFotos: boolean }) {
  const { empezar } = useSeleccion();

  return (
    <button
      type="button"
      onClick={() => {
        empezar();
        document
          .getElementById("galeria")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className={botonWhatsApp}
    >
      <IconoWhatsApp />
      {hayFotos ? "Pedir presupuesto" : "Pedir presupuesto"}
    </button>
  );
}

/* ------------------------------------------------------------------ galería */

export function GaleriaPublica({
  fotos,
  videos,
  nombre,
}: {
  fotos: PiezaPublica[];
  videos: PiezaPublica[];
  nombre: string;
}) {
  const { eligiendo, gustaron, alternar } = useSeleccion();
  // Qué lista está abierta en el visor y en qué posición.
  const [visor, setVisor] = useState<{ lista: "fotos" | "videos"; i: number } | null>(
    null,
  );
  const [reciente, setReciente] = useState<string | null>(null);

  const abrir = (lista: "fotos" | "videos", i: number) => setVisor({ lista, i });

  const piezasVisor = visor?.lista === "videos" ? videos : fotos;

  return (
    <>
      {fotos.length > 0 && (
        <div id="galeria">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-rotulo text-[12.5px] uppercase tracking-[0.22em] text-gray-70">
              Fotos
            </h3>
            {eligiendo && (
              <span className="nota text-[12px] text-gray-45">
                Tocá las que te gusten
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fotos.map((p, i) => {
              const marcada = gustaron.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    if (eligiendo) {
                      alternar(p.id);
                      setReciente(p.id);
                    } else {
                      abrir("fotos", i);
                    }
                  }}
                  aria-label={eligiendo ? "Me gusta esta foto" : "Ver la foto"}
                  aria-pressed={eligiendo ? marcada : undefined}
                  className="group relative aspect-[4/3] w-full cursor-pointer overflow-hidden border border-gray-20 bg-paper-dim"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={nombre}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />

                  {/* En modo elegir, el velo baja para que el corazón se lea. */}
                  {eligiendo && (
                    <span
                      aria-hidden="true"
                      className={`absolute inset-0 transition-colors ${
                        marcada ? "bg-black/25" : "bg-black/0 group-hover:bg-black/15"
                      }`}
                    />
                  )}

                  {eligiendo && marcada && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 grid place-items-center"
                    >
                      {reciente === p.id && (
                        <span className="onda-like absolute h-20 w-20 rounded-full bg-marca/40" />
                      )}
                      <Marca
                        tipo="corazon"
                        className={`h-16 w-16 drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] ${
                          reciente === p.id ? "corazon-late" : ""
                        }`}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div className={fotos.length > 0 ? "mt-14" : ""}>
          <h3 className="mb-4 font-rotulo text-[12.5px] uppercase tracking-[0.22em] text-gray-70">
            Videos
          </h3>

          {/* Los videos van en menos columnas: se miran, no se hojean. */}
          <div className="grid gap-4 sm:grid-cols-2">
            {videos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => abrir("videos", i)}
                aria-label="Ver el video"
                className="group relative aspect-video w-full cursor-pointer overflow-hidden border border-gray-20 bg-black"
              >
                <video
                  src={p.url}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 grid place-items-center"
                >
                  <span className="grid h-14 w-14 place-items-center border border-white/70 bg-black/40 transition-colors group-hover:bg-black/70">
                    <svg viewBox="0 0 16 16" className="h-5 w-5 text-white" aria-hidden="true">
                      <path d="M4.5 2.5 L13 8 L4.5 13.5 Z" fill="currentColor" />
                    </svg>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Lightbox
        piezas={piezasVisor}
        indice={visor?.i ?? null}
        alCambiar={(i) => setVisor((v) => (v ? { ...v, i } : v))}
        alCerrar={() => setVisor(null)}
      />
    </>
  );
}

/* ------------------------------------------------------- barra de selección */

/**
 * La barra que aparece al elegir favoritas. El mensaje de WhatsApp lleva la
 * cuenta y los números de las fotos, que es lo que Halley necesita para
 * ubicarlas en la galería.
 */
export function BarraSeleccion({
  whatsapp,
  categoria,
  fotos,
}: {
  whatsapp: string;
  categoria: string;
  fotos: PiezaPublica[];
}) {
  const { eligiendo, gustaron, cancelar } = useSeleccion();
  if (!eligiendo) return null;

  const numeros = fotos
    .map((f, i) => (gustaron.has(f.id) ? i + 1 : null))
    .filter((n): n is number => n !== null);

  const mensaje =
    numeros.length > 0
      ? `Hola Halley, quiero pedir presupuesto de ${categoria.toLowerCase()}. Me gustaron estas fotos de la galería: ${numeros
          .map((n) => `#${n}`)
          .join(", ")}.`
      : `Hola Halley, quiero pedir presupuesto de ${categoria.toLowerCase()}.`;

  const url = `https://wa.me/${whatsapp.replace(/[^\d]/g, "")}?text=${encodeURIComponent(mensaje)}`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1140px] flex-wrap items-center justify-between gap-4 px-6 py-4 sm:px-10">
        <div className="flex items-center gap-3">
          <Marca tipo="corazon" className="h-7 w-7 shrink-0" />
          <div>
            <div className="font-rotulo text-[12.5px] uppercase tracking-[0.06em]">
              {numeros.length === 0
                ? "Elegí las que te gusten"
                : `${numeros.length} ${numeros.length === 1 ? "foto elegida" : "fotos elegidas"}`}
            </div>
            <div className="nota text-[11.5px] text-gray-45">
              Van en el mensaje para que sepamos qué te gustó
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={cancelar} className={botonFantasma}>
            Cancelar
          </button>
          <a href={url} target="_blank" rel="noreferrer" className={botonWhatsApp}>
            <IconoWhatsApp />
            Pedir presupuesto
            <IconoFlecha />
          </a>
        </div>
      </div>
    </div>
  );
}
