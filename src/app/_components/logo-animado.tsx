"use client";

import { useEffect, useRef, useState } from "react";

/**
 * El cometa que dibuja el logo, dentro de la sección del concepto.
 *
 * Antes se llevaba una pantalla entera en negro: mucho espacio para una
 * animación de ocho segundos, y cortaba la lectura en dos. Ahora es una pieza
 * acotada al lado del texto —el cometa que se ve una vez cada setenta y cinco
 * años, junto al párrafo que habla justamente de eso—.
 *
 * Dos cosas pasan a la vez mientras se scrollea:
 *
 * - El video avanza cuadro a cuadro. No es un GIF: un GIF se reproduce a su
 *   ritmo y no hay forma de llevarlo a un cuadro determinado. El archivo está
 *   codificado con todos los cuadros como keyframe para que cada salto sea
 *   instantáneo.
 * - La pieza se desplaza más lento que la página. Ese desfasaje es el parallax:
 *   da sensación de profundidad sin mover nada de lugar.
 */

/** Cuánto se corre la pieza respecto de la página, en píxeles. */
const RECORRIDO_PARALLAX = 56;

export function LogoAnimado({ className = "" }: { className?: string }) {
  const marco = useRef<HTMLDivElement>(null);
  const capa = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [quieto, setQuieto] = useState(false);

  useEffect(() => {
    const prefiere = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (prefiere.matches) {
      setQuieto(true);
      return;
    }

    const v = video.current;
    const m = marco.current;
    if (!v || !m) return;

    let pedido = 0;
    let avance = 0;

    const medir = () => {
      const caja = m.getBoundingClientRect();
      const alto = window.innerHeight;
      // De 0 —la pieza asomando por abajo— a 1 —ya saliendo por arriba—.
      const bruto = (alto - caja.top) / (alto + caja.height);
      avance = Math.min(Math.max(bruto, 0), 1);
    };

    const pintar = () => {
      pedido = 0;

      const dur = v.duration;
      if (Number.isFinite(dur) && dur > 0) {
        // Se deja un pelo antes del final: el último cuadro de un mp4 a veces no
        // se puede buscar y quedaría en negro justo al terminar.
        const t = avance * (dur - 0.05);
        if (Math.abs(v.currentTime - t) > 0.01) v.currentTime = t;
      }

      if (capa.current) {
        const corrimiento = (0.5 - avance) * RECORRIDO_PARALLAX;
        capa.current.style.transform = `translate3d(0, ${corrimiento}px, 0)`;
      }
    };

    const alScrollear = () => {
      medir();
      pedido ||= requestAnimationFrame(pintar);
    };

    medir();
    if (v.readyState >= 1) pintar();
    else v.addEventListener("loadedmetadata", pintar, { once: true });

    window.addEventListener("scroll", alScrollear, { passive: true });
    window.addEventListener("resize", alScrollear);
    return () => {
      window.removeEventListener("scroll", alScrollear);
      window.removeEventListener("resize", alScrollear);
      if (pedido) cancelAnimationFrame(pedido);
    };
  }, []);

  return (
    <div
      ref={marco}
      aria-label="Halley Audiovisual"
      // El recorte es lo que permite el parallax: la capa de adentro se mueve y
      // lo que se sale del marco no se ve.
      className={`relative aspect-[16/10] overflow-hidden bg-black ${className}`}
    >
      {/* Más alta que el marco para que al desplazarse no descubra un borde. */}
      <div
        ref={capa}
        className="absolute inset-x-0 -inset-y-[8%] will-change-transform"
      >
        {quieto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/marca/logo-animado.jpg"
            alt="Halley Audiovisual"
            className="h-full w-full object-cover"
          />
        ) : (
          <video
            ref={video}
            src="/marca/logo-animado.mp4"
            poster="/marca/logo-animado.jpg"
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
        )}
      </div>
    </div>
  );
}
