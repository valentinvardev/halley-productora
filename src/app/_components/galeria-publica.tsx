"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { api } from "~/trpc/react";

import { IconoFlecha, IconoWhatsApp } from "./iconos";
import { Lightbox, type PiezaLightbox } from "./lightbox";
import { Marca } from "./marca";
import { botonFantasma, botonWhatsApp } from "./ui";

/**
 * Una pieza de la vitrina, con lo que la grilla necesita de más: la forma.
 *
 * `ancho` y `alto` son del original, en píxeles. La grilla no los usa como
 * tamaño sino como proporción, para reservarle el lugar a la foto antes de que
 * la foto llegue. Vienen sin valor en las piezas viejas, que se miden solas la
 * primera vez que alguien abre la categoría.
 */
export type PiezaPublica = PiezaLightbox & {
  ancho?: number | null;
  alto?: number | null;
  /** Cuántos corazones lleva. Las piezas viejas arrancan en cero. */
  likes?: number;
};

/**
 * Qué fotos ya likeó esta persona, guardado en su navegador.
 *
 * Sin sesión no hay forma de saberlo del lado del servidor, y sin esto el
 * corazón se podría tocar diez veces y cada una contaría. El servidor tiene
 * su propio freno por origen, pero éste es el que evita el doble toque
 * accidental y el que deja el corazón pintado al volver.
 */
const CLAVE_LIKES = "halley-likes";

function leerLikes(): Set<string> {
  try {
    const crudo = localStorage.getItem(CLAVE_LIKES);
    const lista: unknown = crudo ? JSON.parse(crudo) : [];
    return new Set(
      Array.isArray(lista) ? lista.filter((x) => typeof x === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function guardarLikes(s: Set<string>) {
  try {
    localStorage.setItem(CLAVE_LIKES, JSON.stringify([...s]));
  } catch {
    // Sin storage el corazón vale para esta visita igual.
  }
}

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

/**
 * El lugar que hay que reservarle a una foto, antes de tenerla.
 *
 * Devuelve la proporción para que el navegador sepa qué alto va a ocupar la
 * foto sabiendo sólo el ancho de la columna. Las piezas todavía sin medir no
 * devuelven nada y se acomodan al llegar: se ve un salto, y desaparece la
 * primera vez que el servidor las mide.
 *
 * El tope es un pasamanos, no una política de recorte. Una vertical de teléfono
 * (9:16), una de cámara (2:3) y una cuadrada pasan sin que se les toque un
 * píxel, que es todo el punto de este cambio. Lo único que ataja es lo que no es
 * una foto: una captura de pantalla larga o un panorama girado, que sin tope se
 * llevan la columna entera y empujan al resto fuera de la vista.
 */
const MAS_ALTA = 1 / 3;

function proporcion(p: PiezaPublica) {
  if (!p.ancho || !p.alto) return undefined;
  return { aspectRatio: String(Math.max(p.ancho / p.alto, MAS_ALTA)) };
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
  const [visor, setVisor] = useState<{
    lista: "fotos" | "videos";
    i: number;
  } | null>(null);
  const [reciente, setReciente] = useState<string | null>(null);

  const abrir = (lista: "fotos" | "videos", i: number) =>
    setVisor({ lista, i });

  const piezasVisor = visor?.lista === "videos" ? videos : fotos;

  /**
   * Los contadores, en pantalla desde el primer toque.
   *
   * El número sube apenas se toca y después el servidor confirma. Esperar la
   * respuesta para mover el número es lo que hace sentir que el toque no
   * entró; y si el servidor frenó el like, el número vuelve a lo que era.
   */
  const [likes, setLikes] = useState<Map<string, number>>(
    () => new Map(fotos.map((f) => [f.id, f.likes ?? 0])),
  );
  const [dados, setDados] = useState<Set<string>>(new Set());
  const [latiendo, setLatiendo] = useState<string | null>(null);
  useEffect(() => setDados(leerLikes()), []);

  const darLike = api.contenido.darLike.useMutation({
    onSuccess: ({ likes: total, contado }, { id }) => {
      setLikes((m) => new Map(m).set(id, total));
      if (!contado) {
        setDados((s) => {
          const n = new Set(s);
          n.delete(id);
          guardarLikes(n);
          return n;
        });
      }
    },
    onError: (_e, { id }) => {
      setLikes((m) => new Map(m).set(id, (m.get(id) ?? 1) - 1));
    },
  });

  function tocarCorazon(id: string) {
    if (dados.has(id) || darLike.isPending) return;
    setDados((s) => {
      const n = new Set(s).add(id);
      guardarLikes(n);
      return n;
    });
    setLikes((m) => new Map(m).set(id, (m.get(id) ?? 0) + 1));
    setLatiendo(id);
    darLike.mutate({ id });
  }

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

          {/* La vitrina, en columnas.

              Antes era una grilla de casilleros iguales de 4:3 y cada foto
              entraba recortada al casillero. A una vertical le cortaba la cabeza
              y los pies, que en fotos de gente es donde está la foto. Ahora es al
              revés: la columna fija el ancho y cada foto se lleva el alto que le
              corresponde por su forma.

              Son columnas de CSS y no una grilla porque una grilla, con piezas de
              alto distinto, deja agujeros al final de cada fila; las columnas
              apilan sin huecos. El costo es el orden: se lee bajando por una
              columna y no cruzando la fila. Es el mismo trato que hace VSCO, que
              es lo que se pidió, y el orden que puso el admin se sigue
              respetando: la primera foto abre arriba a la izquierda. */}
          <div className="columns-2 gap-4 lg:columns-3">
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
                  // La proporción va acá y no en la imagen para que el lugar
                  // quede reservado desde el primer pintado: sin esto la columna
                  // arranca en cero y se estira a los tirones a medida que cada
                  // foto llega, que es lo que hace saltar la página bajo el dedo.
                  style={proporcion(p)}
                  className="group relative mb-4 block w-full cursor-pointer overflow-hidden border border-gray-20 bg-paper-dim break-inside-avoid"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.urlMini ?? p.url}
                    alt={nombre}
                    loading="lazy"
                    // `cover` y no `contain`: con la proporción de la propia foto
                    // los dos dan lo mismo, y en las viejas todavía sin medir
                    // `cover` evita que quede un marco vacío alrededor.
                    className="block h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />

                  {/* En modo elegir, el velo baja para que la marca se lea. */}
                  {eligiendo && (
                    <span
                      aria-hidden="true"
                      className={`absolute inset-0 transition-colors ${
                        marcada
                          ? "bg-black/25"
                          : "bg-black/0 group-hover:bg-black/15"
                      }`}
                    />
                  )}

                  {/* Elegida para el presupuesto: un tilde, no un corazón. El
                      corazón pasó a ser el like público y no puede significar
                      dos cosas en la misma foto. */}
                  {eligiendo && marcada && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 grid place-items-center"
                    >
                      {reciente === p.id && (
                        <span className="onda-like absolute h-20 w-20 rounded-full bg-paper/40" />
                      )}
                      <Marca
                        tipo="confirmado"
                        color="#ffffff"
                        className={`h-16 w-16 drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] ${
                          reciente === p.id ? "corazon-late" : ""
                        }`}
                      />
                    </span>
                  )}

                  {/* El corazón con su cuenta, siempre a la vista.

                      Es un `span` con rol de botón y no un `button` porque
                      ya está adentro de uno: un botón dentro de otro no es
                      HTML válido y los navegadores lo desarman. Se detiene la
                      propagación para que tocarlo no abra el visor ni marque
                      la foto. */}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={
                      dados.has(p.id) ? "Ya te gustó" : "Me gusta esta foto"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      tocarCorazon(p.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        tocarCorazon(p.id);
                      }
                    }}
                    className={`absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/45 px-2 py-1 font-rotulo text-[11px] tracking-[0.06em] text-white backdrop-blur-sm transition-colors ${
                      dados.has(p.id)
                        ? "cursor-default"
                        : "cursor-pointer hover:bg-black/65"
                    }`}
                  >
                    <Marca
                      tipo="corazon"
                      color={dados.has(p.id) ? "var(--color-marca)" : "#ffffff"}
                      grosor={dados.has(p.id) ? 6 : 4}
                      className={`h-4 w-4 ${latiendo === p.id ? "corazon-late" : ""}`}
                    />
                    <span>{likes.get(p.id) ?? p.likes ?? 0}</span>
                  </span>
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
                  disablePictureInPicture
                  disableRemotePlayback
                  preload="metadata"
                  className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 grid place-items-center"
                >
                  <span className="grid h-14 w-14 place-items-center border border-white/70 bg-black/40 transition-colors group-hover:bg-black/70">
                    <svg
                      viewBox="0 0 16 16"
                      className="h-5 w-5 text-white"
                      aria-hidden="true"
                    >
                      <path
                        d="M4.5 2.5 L13 8 L4.5 13.5 Z"
                        fill="currentColor"
                      />
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
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className={botonWhatsApp}
          >
            <IconoWhatsApp />
            Pedir presupuesto
            <IconoFlecha />
          </a>
        </div>
      </div>
    </div>
  );
}
