"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Una foto con alguien recortado que se mueve distinto que el fondo.
 *
 * En el manteo de egresados la tanda levanta a uno con una tela. La foto congela
 * ese momento; acá el que está en el aire sube mientras se scrollea, y el campo
 * se queda un poco atrás. Ese desfasaje entre las dos capas es todo el efecto:
 * no hay animación, hay dos cosas moviéndose a distinta velocidad.
 *
 * El problema real de esto es el calce. La figura salió recortada del mismo
 * cuadro que el fondo, así que hay una única posición en la que las dos imágenes
 * vuelven a ser la foto original, y errarle por poco se nota muchísimo.
 *
 * Se resuelve sin matemática: las dos viven adentro de un lienzo que tiene la
 * proporción exacta del archivo, y la figura se ubica en porcentajes de ese
 * lienzo. Mientras el lienzo mantenga la proporción, el calce es exacto en
 * cualquier tamaño de pantalla, y lo único que se mueve son los desplazamientos
 * del parallax —que arrancan de cero justo cuando la banda está al medio—.
 *
 * En pantallas angostas la banda se queda corta —una foto apaisada en un
 * teléfono es una tirita—, así que se le pone un alto mínimo y el lienzo crece
 * hasta taparlo, recortando por los costados. Se recorta a lo ancho a propósito:
 * la figura está sobre el centro, y de los cuatro lados es el único que se puede
 * perder sin perderla a ella.
 */

/** Cuánto viaja cada capa, en fracción del alto de la banda. */
const VIAJE_FIGURA = 0.12;
const VIAJE_FONDO = 0.05;

/**
 * Cuánto se agranda el fondo.
 *
 * Tiene que sobrar por los cuatro lados lo que el fondo se va a correr, o al
 * desplazarse descubre el borde. Con la mitad del viaje alcanza; va un poco más
 * por las dudas.
 */
const HOLGURA_FONDO = 1 + VIAJE_FONDO + 0.01;

export function FondoParallax({
  fondo,
  figura,
  alt,
  caja,
  className = "",
}: {
  fondo: string;
  figura: string;
  alt: string;
  /** Dónde cae la figura dentro del cuadro, en % — sale del recorte. */
  caja: { izquierda: number; arriba: number; ancho: number };
  className?: string;
}) {
  const banda = useRef<HTMLDivElement>(null);
  const capaFondo = useRef<HTMLImageElement>(null);
  const capaFigura = useRef<HTMLImageElement>(null);
  const [quieto, setQuieto] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setQuieto(true);
      return;
    }

    const b = banda.current;
    if (!b) return;

    let pedido = 0;

    const pintar = () => {
      pedido = 0;
      const rect = b.getBoundingClientRect();
      const ventana = window.innerHeight;

      // El avance va de que la banda asoma por abajo a que termina de salir por
      // arriba. No hay nada que "completar" acá —es una deriva, no un dibujo—,
      // así que se usa el viaje entero.
      const total = ventana + rect.height;
      const crudo = total > 0 ? (ventana - rect.top) / total : 0;
      const avance = Math.min(Math.max(crudo, 0), 1);

      // Cero justo en el medio del viaje: ahí las dos capas vuelven a estar
      // donde estaban en la foto, y el recorte es invisible.
      const desde = 0.5 - avance;

      if (capaFigura.current) {
        capaFigura.current.style.transform = `translate3d(0, ${
          desde * VIAJE_FIGURA * rect.height
        }px, 0)`;
      }
      if (capaFondo.current) {
        // Al revés que la figura y más despacio: el campo se queda atrás
        // mientras el otro sube.
        capaFondo.current.style.transform = `translate3d(0, ${
          -desde * VIAJE_FONDO * rect.height
        }px, 0) scale(${HOLGURA_FONDO})`;
      }
    };

    const alScrollear = () => {
      pedido ||= requestAnimationFrame(pintar);
    };

    pintar();
    window.addEventListener("scroll", alScrollear, { passive: true });
    window.addEventListener("resize", alScrollear);
    return () => {
      window.removeEventListener("scroll", alScrollear);
      window.removeEventListener("resize", alScrollear);
      if (pedido) cancelAnimationFrame(pedido);
    };
  }, []);

  return (
    <section
      className={`relative w-full overflow-hidden border-b border-gray-20 ${className}`}
    >
      {/* La banda: manda la proporción del archivo, con un piso de alto para que
          en un teléfono no quede una tirita. */}
      <div
        ref={banda}
        className="relative aspect-[1620/911] min-h-[360px] w-full"
      >
        {/* El lienzo. Mide siempre la proporción del archivo —por eso el ancho
            mínimo acompaña al alto mínimo de la banda: 640 / (1620/911) = 360—,
            y va centrado, así lo que sobra se recorta parejo por los costados. */}
        <div className="absolute top-1/2 left-1/2 aspect-[1620/911] w-full min-w-[640px] -translate-x-1/2 -translate-y-1/2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={capaFondo}
            src={fondo}
            alt={alt}
            loading="lazy"
            decoding="async"
            draggable={false}
            className={`absolute inset-0 h-full w-full object-cover ${
              quieto ? "" : "will-change-transform"
            }`}
          />
          {/* La figura, en porcentajes del lienzo: es la misma posición que tenía
              en el cuadro del que se recortó. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={capaFigura}
            src={figura}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            draggable={false}
            style={{
              left: `${caja.izquierda}%`,
              top: `${caja.arriba}%`,
              width: `${caja.ancho}%`,
            }}
            className={`absolute h-auto ${quieto ? "" : "will-change-transform"}`}
          />
        </div>
      </div>
    </section>
  );
}
