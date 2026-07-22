"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Panel chico anclado al botón que lo abre.
 *
 * No usa `<dialog>` como el modal y el cajón: aquéllos toman la pantalla
 * entera y oscurecen el fondo, que es demasiado para dos opciones de cuenta.
 * Éste aparece pegado a su botón y se va al primer clic afuera o con Escape.
 */
export function Popover({
  abierto,
  alCerrar,
  children,
  className = "",
}: {
  abierto: boolean;
  alCerrar: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;

    // `pointerdown` y no `click`: cerrar tiene que pasar antes de que el clic
    // active lo que haya debajo.
    const afuera = (e: PointerEvent) => {
      const caja = ref.current;
      if (!caja) return;
      const destino = e.target as Node;
      // El propio botón que abre queda fuera de la caja: si lo tocan, que
      // maneje él el cierre y no se cierre dos veces.
      if (!caja.contains(destino) && !caja.parentElement?.contains(destino)) {
        alCerrar();
      }
    };

    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };

    document.addEventListener("pointerdown", afuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", afuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto, alCerrar]);

  if (!abierto) return null;

  return (
    <div
      ref={ref}
      className={`popover absolute top-[calc(100%+10px)] right-0 z-50 min-w-[236px] border border-ink bg-paper p-4 ${className}`}
    >
      {children}
    </div>
  );
}
