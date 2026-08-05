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
 * El tramo de scroll del dibujo, medido en pantallas y no en secciones.
 *
 * El trazo arranca cuando la pieza asoma por abajo —`ARRANQUE`, una pantalla— y
 * termina cuando su borde de arriba casi toca el borde de arriba de la ventana
 * —`REMATE`—. Entre esos dos puntos hay poco menos de una pantalla de scroll,
 * que es más o menos lo que había antes.
 *
 * Que el tramo se mida contra la ventana es el punto: antes se medía contra la
 * sección, así que la sección tenía que ser altísima —una pantalla y media— sólo
 * para darle recorrido al dibujo, y ese alto de más se veía como un hueco
 * enorme alrededor del texto. Contra la ventana, el recorrido es el mismo con la
 * sección midiendo lo que mide su contenido.
 *
 * El remate no es cero para que el logo terminado se pueda mirar un momento
 * antes de que la pieza se vaya: si el trazo se completara justo al salir, no
 * se llegaría a ver nunca entero.
 */
const ARRANQUE = 1;
const REMATE = 0.05;

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
      const ventana = window.innerHeight;

      // El dibujo se reparte sobre el viaje de la pieza por la ventana, de abajo
      // hacia arriba. Mientras se dibuja está siempre a la vista, y el tramo
      // mide lo mismo sin importar cuánto mida la sección.
      const total = (ARRANQUE - REMATE) * ventana;
      const crudo = (ARRANQUE * ventana - caja.top) / total;

      avance = Math.min(Math.max(crudo, 0), 1);
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
    // Una sola caja, del tamaño de la pieza. Antes había otra por fuera que
    // abarcaba la sección entera: era la que le medía el scroll al dibujo, y ya
    // no hace falta porque el recorrido se mide contra la ventana.
    //
    // Apaisada y no cuadrada: el video es 16:9 y en un cuadrado quedaba con
    // bandas vacías arriba y abajo.
    <div
      ref={marco}
      aria-hidden="true"
      className={`cometa pointer-events-none absolute aspect-[16/10] overflow-hidden ${className}`}
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
