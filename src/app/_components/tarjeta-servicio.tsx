"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Una tarjeta de la grilla de servicios, y el disparador de su animación.
 *
 * En escritorio la animación va con el cursor: eso lo resuelve el CSS con
 * `:hover` y acá no hace falta nada. En un teléfono no hay cursor, así que se
 * dispara al entrar en pantalla.
 *
 * El observador se arma sólo donde no hay cursor —`(hover: none)`— y no por
 * ancho de pantalla. La pregunta real no es cuán grande es la pantalla sino si
 * hay con qué apuntar: una notebook angosta tiene cursor y una tablet grande no.
 *
 * La clase se saca al salir de vista y no queda pegada. Así la tarjeta vuelve a
 * animarse si uno sube y baja, que es lo que se espera de algo atado al scroll,
 * y de paso no quedan diez tarjetas con transformaciones vivas fuera de pantalla.
 */
export function TarjetaServicio({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const caja = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    if (!window.matchMedia("(hover: none)").matches) return;

    const mirando = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada) return;
        el.classList.toggle("a-la-vista", entrada.isIntersecting);
      },
      // Que tenga que entrar bastante antes de contar: con el umbral en cero la
      // tarjeta se dispara con el primer píxel asomando, cuando todavía no se ve
      // nada de lo que se está animando.
      { threshold: 0.45 },
    );

    mirando.observe(el);
    return () => mirando.disconnect();
  }, []);

  return (
    <article ref={caja} className={`tarjeta-servicio ${className}`}>
      {children}
    </article>
  );
}
