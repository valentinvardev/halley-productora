"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Aparece cuando entra en pantalla.
 *
 * Un fundido corto con un empujón desde abajo, una sola vez: la animación que
 * se repite cada vez que el bloque vuelve a cruzar el borde termina mareando en
 * una página que se recorre para arriba y para abajo.
 *
 * Se dispara un poco antes de que el bloque llegue al borde inferior —de ahí el
 * margen negativo— para que el movimiento se vea entrando, no después de que ya
 * estaba a la vista.
 *
 * Con `prefers-reduced-motion` no hay animación: el contenido aparece y listo.
 * Y si no hay JavaScript o el navegador no soporta el observador, el contenido
 * queda visible igual — nunca se esconde algo que no se pueda volver a mostrar.
 */
export function Aparecer({
  children,
  demora = 0,
  className = "",
}: {
  children: React.ReactNode;
  /** Segundos de espera, para escalonar varios bloques seguidos. */
  demora?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada?.isIntersecting) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );

    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`aparecer ${className}`}
      data-visible={visible}
      style={demora ? { transitionDelay: `${demora}s` } : undefined}
    >
      {children}
    </div>
  );
}
