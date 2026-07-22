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
 */
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
      // En un dialog nativo, el clic en el fondo llega con el dialog como
      // target: es la forma de distinguirlo del clic adentro del contenido.
      onClick={(e) => {
        if (e.target === ref.current) alCerrar();
      }}
      className="m-auto hidden max-h-[calc(100vh-2rem)] w-[min(560px,calc(100vw-2rem))] border border-ink bg-paper p-0 text-ink backdrop:bg-[rgba(10,10,10,0.55)] open:flex open:flex-col"
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
