"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { IconoCruz } from "./iconos";

/**
 * Modal sobre `<dialog>` nativo.
 *
 * Se usa el elemento del navegador y no un div flotante porque trae gratis lo
 * que siempre se implementa mal a mano: el foco atrapado adentro, Escape para
 * cerrar, el resto de la página inerte para el lector de pantalla y la capa
 * superior sin pelear con z-index.
 *
 * Los dos detalles de abajo —el guardia del `onClose` y el contador del
 * scroll— existen por lo mismo: que un modal se abra adentro de otro. Pasa en
 * cuanto una pantalla necesita elegir algo sin perder lo que estaba editando, y
 * los dos problemas que trae no se ven hasta que pasa.
 */

/**
 * Cuántos modales hay abiertos, en toda la página.
 *
 * El scroll del fondo es uno solo, así que quien lo bloquea y quien lo suelta
 * también tienen que ser uno solo. La versión anterior guardaba el valor
 * anterior en cada modal y lo restauraba al cerrarse, y con dos abiertos eso
 * depende de que se cierren en el orden exacto en que se abrieron: cerrando al
 * revés, el de afuera restauraba "hidden" —que era lo que había cuando él
 * abrió— y la página quedaba sin scroll para siempre.
 *
 * Con un contador no hay orden que respetar: bloquea el primero que abre y
 * suelta el último que cierra.
 */
let abiertos = 0;
let overflowPrevio = "";
export function Modal({
  abierto,
  alCerrar,
  eyebrow,
  titulo,
  children,
}: {
  abierto: boolean;
  alCerrar: () => void;
  eyebrow?: string;
  titulo: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;

    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  // `showModal` bloquea la interacción de atrás pero no el scroll del fondo.
  useEffect(() => {
    if (!abierto) return;

    if (abiertos === 0) {
      overflowPrevio = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    abiertos += 1;

    return () => {
      abiertos -= 1;
      if (abiertos === 0) document.body.style.overflow = overflowPrevio;
    };
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      // El `close` de un `<dialog>` no burbujea en el navegador, pero React sí
      // lo propaga por su propio árbol —hace lo mismo con `focus` y `blur`—, y
      // eso con modales anidados es una trampa: al cerrar el de adentro, el
      // evento subía y cerraba también a los de afuera. Se veía como que elegir
      // una imagen descartaba la edición entera sin preguntar nada.
      //
      // El guardia es el mismo que el del clic: sólo me cierro si el evento es
      // mío.
      onClose={(e) => {
        if (e.target === ref.current) alCerrar();
      }}
      // En un dialog nativo, el clic en el fondo llega con el dialog como
      // target: es la forma de distinguirlo del clic adentro del contenido.
      onClick={(e) => {
        if (e.target === ref.current) alCerrar();
      }}
      className="capa capa-modal m-auto hidden max-h-[calc(100vh-2rem)] w-[min(560px,calc(100vw-2rem))] border border-ink bg-paper p-0 text-ink open:flex open:flex-col"
    >
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-ink px-6 py-4">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2 className="mt-1 text-[19px] leading-tight">{titulo}</h2>
        </div>
        <button
          type="button"
          onClick={alCerrar}
          aria-label="Cerrar"
          className="mt-0.5 cursor-pointer text-gray-45 hover:text-ink"
        >
          <IconoCruz className="h-4 w-4" />
        </button>
      </header>

      <div className="overflow-y-auto px-6 py-5">{children}</div>
    </dialog>
  );
}
