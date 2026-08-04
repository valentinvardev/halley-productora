"use client";

import { useEffect, useRef, useState } from "react";

/**
 * El cometa que dibuja el logo, dentro de la sección del concepto.
 *
 * Antes se llevaba una pantalla entera en negro: mucho espacio para una
 * animación de ocho segundos, y cortaba la lectura en dos. Ahora va al lado del
 * título —el cometa que se ve una vez cada setenta y cinco años, junto a la
 * frase que habla justamente de eso— y sin caja: el fondo negro del archivo se
 * saca con mezcla, así el trazo queda sobre el papel de la sección.
 *
 * Al no haber caja, el video va con `object-contain`: no hace falta recortarlo
 * para que llene nada, y el recorrido del cometa se ve entero.
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

/**
 * Cuánto del recorrido se usa para dibujar el logo.
 *
 * Con 1 la animación entera entra en el tramo que la sección tarda en cruzar la
 * pantalla, y en un scroll rápido pasa entera en un pestañeo. Con un valor más
 * chico se reparte el mismo dibujo en más scroll: avanza más despacio y se
 * alcanza a ver. El resto del tramo queda con el logo ya formado.
 */
const TRAMO_UTIL = 0.55;

/**
 * Cuánto se acerca el video a su objetivo en cada cuadro.
 *
 * Sin esto, cada golpe de rueda salta varios cuadros de una y el dibujo se ve a
 * los tirones. Persiguiendo el objetivo de a poco, el trazo avanza continuo
 * aunque el scroll llegue a los saltos.
 */
const SUAVIDAD = 0.12;

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
    /** Dónde está el video ahora; persigue a `avance` sin alcanzarlo de golpe. */
    let actual = 0;

    const medir = () => {
      const caja = m.getBoundingClientRect();
      const alto = window.innerHeight;
      // De 0 —la pieza asomando por abajo— a 1 —ya saliendo por arriba—.
      const bruto = (alto - caja.top) / (alto + caja.height);
      const crudo = Math.min(Math.max(bruto, 0), 1);
      // El dibujo se reparte sólo en un tramo: más scroll para lo mismo.
      avance = Math.min(crudo / TRAMO_UTIL, 1);
    };

    const pintar = () => {
      const dur = v.duration;
      const falta = avance - actual;

      // Mientras quede camino se sigue pidiendo cuadro; cuando llega, se corta y
      // el bucle queda dormido hasta el próximo scroll.
      if (Math.abs(falta) > 0.0005) {
        actual += falta * SUAVIDAD;
        pedido = requestAnimationFrame(pintar);
      } else {
        actual = avance;
        pedido = 0;
      }

      if (Number.isFinite(dur) && dur > 0) {
        // Se deja un pelo antes del final: el último cuadro de un mp4 a veces no
        // se puede buscar y quedaría en negro justo al terminar.
        const t = actual * (dur - 0.05);
        if (Math.abs(v.currentTime - t) > 0.005) v.currentTime = t;
      }

      if (capa.current) {
        // El parallax sigue al scroll sin suavizado: es un desplazamiento, y
        // arrastrarlo se sentiría como que la pieza flota despegada del papel.
        const corrimiento = (0.5 - avance) * RECORRIDO_PARALLAX;
        capa.current.style.transform = `translate3d(0, ${corrimiento}px, 0)`;
      }
    };

    const alScrollear = () => {
      medir();
      pedido ||= requestAnimationFrame(pintar);
    };

    medir();
    actual = avance;
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
      // La posición la decide quien lo usa —hoy va absoluto, de fondo—, así que
      // el marco no la fija: si acá dijera `relative` chocaría con el `absolute`
      // que le pasan y cuál gana dependería del orden del CSS, no del código.
      //
      // Sin caja ni fondo: el trazo queda sobre el papel de la sección. El
      // recorte es lo que permite el parallax —la capa de adentro se mueve y lo
      // que se sale del marco no se ve—.
      className={`cometa aspect-square overflow-hidden ${className}`}
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
            className="h-full w-full object-contain"
          />
        ) : (
          <video
            ref={video}
            src="/marca/logo-animado.mp4"
            poster="/marca/logo-animado.jpg"
            muted
            playsInline
            disablePictureInPicture
            disableRemotePlayback
            preload="auto"
            aria-hidden="true"
            className="h-full w-full object-contain"
          />
        )}
      </div>
    </div>
  );
}
