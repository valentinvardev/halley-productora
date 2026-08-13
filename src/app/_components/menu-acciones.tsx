"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { IconoPuntos } from "./iconos";
import { Boton } from "./ui";

/**
 * Un botón que despliega acciones.
 *
 * Existe porque el encabezado del evento se estaba llenando de botones sueltos:
 * tres en fila ya no entraban en un teléfono, y cada uno nuevo empujaba al
 * siguiente. Agrupados, el encabezado vuelve a tener un solo botón y la lista
 * puede crecer sin pelear por el ancho.
 *
 * Se cierra al elegir algo, con Escape y al hacer clic afuera. Las tres son la
 * misma expectativa —que un menú no se quede abierto— y si falta alguna se nota.
 */
export function MenuAcciones({
  children,
  etiqueta = "Acciones",
}: {
  children: ReactNode;
  etiqueta?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;

    const afuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };

    // En captura: si un clic adentro del menú desmonta lo que se clickeó, para
    // cuando el evento burbujee ya no hay nodo que contener y el menú quedaría
    // abierto.
    document.addEventListener("mousedown", afuera, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", afuera, true);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  return (
    <div ref={caja} className="relative">
      <Boton
        variante="fantasma"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-haspopup="menu"
      >
        <IconoPuntos />
        {etiqueta}
      </Boton>

      {abierto && (
        <div
          role="menu"
          // Se cierra al elegir cualquier cosa de adentro, así no hay que
          // acordarse de cerrarlo en cada acción.
          onClick={() => setAbierto(false)}
          className="menu-acciones absolute right-0 z-30 mt-2 flex w-[240px] flex-col border border-ink bg-lienzo py-1 shadow-[0_2px_14px_rgb(0_0_0/0.12)]"
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Una fila del menú. */
export function ItemAccion({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2.5 px-4 py-2.5 text-left text-[13.5px] text-ink transition-colors hover:bg-paper-dim disabled:opacity-40"
    >
      {children}
    </button>
  );
}
