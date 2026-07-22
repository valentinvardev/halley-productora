"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { IconoCruz } from "./iconos";

/**
 * Cajón lateral: el panel que entra desde el borde derecho.
 *
 * Es el mismo `<dialog>` que usa el modal, por las mismas razones —foco
 * atrapado adentro, Escape para cerrar, el resto de la página inerte— y comparte
 * con él las clases `capa`, así que entra, sale y desenfoca el fondo igual.
 * Lo único propio es de dónde viene y qué forma tiene.
 */
export function Cajon({
  abierto,
  alCerrar,
  titulo,
  children,
}: {
  abierto: boolean;
  alCerrar: () => void;
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

  useEffect(() => {
    if (!abierto) return;

    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onClose={alCerrar}
      onClick={(e) => {
        if (e.target === ref.current) alCerrar();
      }}
      className="capa capa-cajon m-0 ml-auto hidden h-full max-h-none w-[min(300px,85vw)] border-l border-ink bg-paper p-0 text-ink open:flex open:flex-col"
    >
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-ink px-5 py-4">
        <h2 className="font-rotulo text-[12px] uppercase tracking-[0.1em] text-gray-70">
          {titulo}
        </h2>
        <button
          type="button"
          onClick={alCerrar}
          aria-label="Cerrar"
          className="cursor-pointer text-gray-45 hover:text-ink"
        >
          <IconoCruz className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-5">{children}</div>
    </dialog>
  );
}

/**
 * Fila del cajón. Es una clase y no un componente porque cada entrada es una
 * cosa distinta —un `Link`, un botón, el submit de un formulario— y envolverlas
 * en un componente común sólo agregaría una capa para volver a desarmarla.
 */
export const itemCajon =
  "block w-full cursor-pointer border-b border-gray-20 py-3 text-left font-rotulo text-[13px] uppercase tracking-[0.06em] last:border-b-0 hover:text-ink";
