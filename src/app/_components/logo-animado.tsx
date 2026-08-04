"use client";

import { useEffect, useRef, useState } from "react";

/**
 * El cometa que dibuja el logo, atado al scroll.
 *
 * No es un GIF: un GIF se reproduce a su ritmo y no hay forma de llevarlo a un
 * frame determinado. Acá el video se usa como una tira de frames y el scroll
 * decide cuál se ve, así la animación avanza cuando se baja y se deshace cuando
 * se sube.
 *
 * El archivo está codificado con todos los frames como keyframe: sin eso, cada
 * salto obligaría al navegador a decodificar desde el keyframe anterior y el
 * movimiento se vería a los tirones.
 *
 * La sección mide varias pantallas de alto —esa altura es la "pista" del
 * scroll— y adentro el video queda pegado. Lo que se recorre es la pista; lo
 * que se ve, siempre el mismo cuadro.
 */

/** Cuántas pantallas dura la animación. Más alto = más lento de recorrer. */
const PANTALLAS = 2.6;

export function LogoAnimado() {
  const pista = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [quieto, setQuieto] = useState(false);

  useEffect(() => {
    // Con movimiento reducido no se scrubbea nada: queda el último cuadro, que
    // es el logo terminado.
    const prefiere = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (prefiere.matches) {
      setQuieto(true);
      return;
    }

    const v = video.current;
    const p = pista.current;
    if (!v || !p) return;

    let pedido = 0;
    let objetivo = 0;

    const medir = () => {
      const caja = p.getBoundingClientRect();
      // Cuánto de la pista ya pasó por arriba del borde superior, de 0 a 1.
      const recorrido = -caja.top;
      const total = caja.height - window.innerHeight;
      const avance = total > 0 ? recorrido / total : 0;
      objetivo = Math.min(Math.max(avance, 0), 1);
    };

    const pintar = () => {
      pedido = 0;
      const dur = v.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;

      // Se deja un pelo antes del final: el último frame de un mp4 a veces no
      // se puede buscar y el video quedaría en negro justo al terminar.
      const t = objetivo * (dur - 0.05);
      // Sin el umbral, cada scroll pide un `seek` nuevo y el decodificador se
      // satura; con él, sólo se mueve cuando hay una diferencia que se nota.
      if (Math.abs(v.currentTime - t) > 0.01) v.currentTime = t;
    };

    const alScrollear = () => {
      medir();
      pedido ||= requestAnimationFrame(pintar);
    };

    medir();
    // El primer pintado espera a saber cuánto dura el video.
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
    <section
      ref={pista}
      aria-label="Halley Audiovisual"
      className="relative bg-black"
      style={{ height: `${PANTALLAS * 100}svh` }}
    >
      <div className="sticky top-0 flex h-svh items-center justify-center overflow-hidden">
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
            // No se reproduce solo: cada cuadro lo elige el scroll.
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
        )}
      </div>
    </section>
  );
}
