"use client";

import { useEffect } from "react";

/**
 * El desenfoque de movimiento mientras la página baja.
 *
 * El scroll suave ya lo hace el CSS; esto es lo otro que se pidió: que además se
 * note el movimiento. El desenfoque de movimiento de verdad —el que promedia los
 * cuadros intermedios— no existe en la web, así que lo que hay es una
 * simulación: se desenfoca apenas el contenido mientras dura el recorrido y se
 * lo devuelve al llegar. Alcanza para que el ojo lea "esto se está moviendo" y
 * no "esto parpadeó".
 *
 * Es un escuchador en el documento y no un `onClick` por link, porque los mismos
 * anclajes están en dos lados —la barra de arriba y los botones del hero— y no
 * tiene sentido acordarse de enganchar cada uno.
 *
 * La cabecera no se desenfoca. Es pegajosa: no se mueve respecto de la pantalla,
 * así que borronearla sería mentir sobre lo que está pasando.
 */

/** Cuánto se espera a que el scroll termine si el navegador no avisa. */
const TOPE = 1200;

export function DesplazamientoSuave() {
  useEffect(() => {
    // Quien pidió menos movimiento no recibe ni el scroll animado ni el
    // desenfoque: el CSS ya lo devuelve al salto, y esto sería un borrón sobre
    // una página que no se movió.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const raiz = document.documentElement;
    let reloj: number | null = null;

    const terminar = () => {
      raiz.classList.remove("desplazando");
      if (reloj !== null) window.clearTimeout(reloj);
      reloj = null;
      window.removeEventListener("scrollend", terminar);
    };

    const alTocar = (e: MouseEvent) => {
      // Sólo el clic común: con Ctrl, Meta o el botón del medio se abre en otra
      // pestaña y acá no se desplaza nada.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;

      const link = (e.target as Element | null)?.closest?.("a");
      const destino = link?.getAttribute("href");
      if (!destino?.startsWith("#") || destino.length < 2) return;
      if (!document.getElementById(destino.slice(1))) return;

      terminar();
      raiz.classList.add("desplazando");

      // `scrollend` es lo correcto y todavía no está en todos lados, así que
      // hay un tope por si nunca llega: un desenfoque que no se apaga es mucho
      // peor que uno que se apaga de más.
      window.addEventListener("scrollend", terminar, { once: true });
      reloj = window.setTimeout(terminar, TOPE);
    };

    document.addEventListener("click", alTocar);
    return () => {
      document.removeEventListener("click", alTocar);
      terminar();
    };
  }, []);

  return null;
}
