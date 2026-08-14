"use client";

import { useRef, useState } from "react";

import { IconoImagen, IconoMas, IconoTilde } from "~/app/_components/iconos";
import { Modal } from "~/app/_components/modal";
import { Boton, Vacio } from "~/app/_components/ui";
import { CATEGORIAS, HERO, PRESUPUESTO } from "~/app/_datos/categorias";
import { api } from "~/trpc/react";

import { LADO_MINIATURA, derivar } from "./derivar";

/**
 * Elegir la foto de algo, sin salir de donde estabas.
 *
 * Ofrece las dos cosas que uno quiere en ese momento: una foto que ya está
 * subida —porque la vitrina ya tiene el trabajo bueno cargado y volver a
 * subirla sería tener el mismo archivo dos veces pagando espacio— o una nueva.
 *
 * Las que se suben desde acá caen en su propia categoría y no en la vitrina: no
 * son trabajo para mostrar en la web, son ilustraciones de un catálogo, y
 * mezclarlas haría que aparecieran en la grilla de una categoría sin que nadie
 * las haya puesto ahí.
 *
 * De cada archivo sube sólo la versión chica. Es lo contrario de la vitrina,
 * donde el original importa porque alguien lo va a mirar a pantalla completa:
 * acá el destino final es un cuadro de setenta y seis píxeles, y guardar cuatro
 * megas para eso es pagar por nada.
 */

/** Cómo se llama cada categoría en el selector de arriba. */
const NOMBRES: Record<string, string> = {
  [PRESUPUESTO]: "Del catálogo",
  [HERO]: "Portada del sitio",
  ...Object.fromEntries(CATEGORIAS.map((c) => [c.slug, c.nombre])),
};

export function ElegirImagen({
  abierto,
  alCerrar,
  valor,
  alElegir,
}: {
  abierto: boolean;
  alCerrar: () => void;
  /** El id de la pieza elegida, o `null`. */
  valor: string | null;
  alElegir: (id: string | null) => void;
}) {
  const [filtro, setFiltro] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  const utils = api.useUtils();
  const imagenes = api.catalogo.imagenes.useQuery(undefined, {
    enabled: abierto,
  });

  const firmar = api.contenido.urlDeSubida.useMutation();
  const guardar = api.catalogo.guardarImagen.useMutation();

  async function subir(f: File) {
    setError(null);
    setSubiendo(true);
    try {
      // Se achica en el navegador antes de salir: sube en segundos en vez de en
      // minutos, y lo que queda guardado es del tamaño en el que se va a ver.
      const chica = await derivar(f, LADO_MINIATURA);
      const firma = await firmar.mutateAsync({
        categoria: PRESUPUESTO,
        contentType: chica.type,
      });

      const r = await fetch(firma.url, {
        method: "PUT",
        headers: { "Content-Type": chica.type },
        body: chica,
      });
      if (!r.ok) throw new Error(`S3 respondió ${r.status}`);

      const pieza = await guardar.mutateAsync({ s3Key: firma.key });
      await utils.catalogo.imagenes.invalidate();
      alElegir(pieza.id);
      alCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setSubiendo(false);
      if (archivo.current) archivo.current.value = "";
    }
  }

  const todas = imagenes.data ?? [];
  const categorias = [...new Set(todas.map((i) => i.categoria))];
  const lista = filtro ? todas.filter((i) => i.categoria === filtro) : todas;

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      eyebrow="Imagen"
      titulo="Elegir una imagen"
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={archivo}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void subir(f);
          }}
        />
        <Boton
          onClick={() => archivo.current?.click()}
          disabled={subiendo}
          className="text-[11.5px]"
        >
          <IconoMas />
          {subiendo ? "Subiendo…" : "Subir una nueva"}
        </Boton>

        {valor && (
          <Boton
            variante="fantasma"
            className="text-[11.5px]"
            onClick={() => {
              alElegir(null);
              alCerrar();
            }}
          >
            Quitar la imagen
          </Boton>
        )}
      </div>

      {error && (
        <p className="mt-3 border border-marca px-3 py-2 text-[13px] text-marca">
          {error}
        </p>
      )}

      {categorias.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {[null, ...categorias].map((c) => (
            <button
              key={c ?? "todas"}
              type="button"
              onClick={() => setFiltro(c)}
              className={`cursor-pointer border px-2.5 py-1.5 font-rotulo text-[10.5px] tracking-[0.06em] uppercase transition-colors ${
                filtro === c
                  ? "border-ink bg-ink text-paper"
                  : "border-gray-20 text-gray-70 hover:border-ink hover:text-ink"
              }`}
            >
              {c === null ? "Todas" : (NOMBRES[c] ?? c)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        {imagenes.isPending ? (
          <p className="nota">Cargando…</p>
        ) : lista.length === 0 ? (
          <Vacio>
            <IconoImagen className="mx-auto mb-2 h-5 w-5" />
            No hay imágenes cargadas. Subí una.
          </Vacio>
        ) : (
          <div className="grid max-h-[42vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {lista.map((i) => {
              const puesta = i.id === valor;
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => {
                    alElegir(i.id);
                    alCerrar();
                  }}
                  className={`relative aspect-square cursor-pointer border transition-colors ${
                    puesta
                      ? "border-ink"
                      : "border-gray-20 hover:border-gray-45"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={i.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  {puesta && (
                    <span className="absolute right-1 bottom-1 flex h-5 w-5 items-center justify-center bg-ink text-paper">
                      <IconoTilde className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * El disparador: la miniatura de lo elegido, o un hueco para elegir.
 *
 * Es un botón con la foto adentro y no una foto con un botón al lado porque el
 * gesto es uno solo —cambiar esta imagen— y partirlo en dos objetos obliga a
 * explicar cuál hace qué.
 */
export function BotonImagen({
  imagen,
  onClick,
  className = "",
}: {
  imagen?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Elegir imagen"
      className={`group relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center border border-gray-20 bg-paper-dim text-gray-45 transition-colors hover:border-ink hover:text-ink ${className}`}
    >
      {imagen ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagen}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-ink/0 text-transparent transition-colors group-hover:bg-ink/60 group-hover:text-paper">
            <IconoImagen className="h-4 w-4" />
          </span>
        </>
      ) : (
        <IconoImagen className="h-4 w-4" />
      )}
    </button>
  );
}
