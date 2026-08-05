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
 * Dónde termina el dibujo dentro del tramo en que la pieza está pegada.
 *
 * Se usa casi todo: el trazo arranca apenas se pega y llega al final poco antes
 * de despegarse. Ese margen del final es para poder mirar el logo terminado un
 * momento antes de que la pieza siga de largo; sin él, se completa justo cuando
 * se va y no se llega a ver.
 */
const HASTA = 0.9;

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
  const pegada = useRef<HTMLDivElement>(null);
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
      const altoPegada = pegada.current?.offsetHeight ?? 0;

      // El dibujo se reparte exactamente sobre el tramo en que la pieza está
      // pegada: empieza cuando se pega —el borde de arriba de la pista llega al
      // borde de la ventana— y termina cuando se despega, al final de la pista.
      // Así la pieza no se va nunca antes de tiempo: mientras se dibuja, está.
      const total = caja.height - altoPegada;
      const crudo = total > 0 ? -caja.top / total : 0;

      const util = Math.min(Math.max(crudo, 0), 1) / HASTA;
      avance = Math.min(util, 1);
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
    // La pista abarca el alto de la sección. No se ve: sólo marca cuánto scroll
    // tiene el dibujo para desarrollarse.
    <div
      ref={marco}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-y-0 ${className}`}
    >
      {/* La pieza se queda quieta mientras la sección pasa por detrás. Eso es lo
          que le da tiempo al trazo: sin esto se iría de pantalla a los pocos
          cientos de píxeles.

          El tramo pegajoso mide una pantalla y la pieza se centra adentro con
          flex. Antes se pegaba a media altura y se subía con `translate`, y eso
          la sacaba fuera de la sección en las dos puntas del recorrido: como el
          recorte tuvo que salir para que `sticky` funcionara, terminaba
          metiéndose encima del hero y de los servicios. */}
      <div ref={pegada} className="sticky top-[16vh]">
        {/* Apaisada, no cuadrada: el video es 16:9 y en un cuadrado quedaba con
            bandas vacías arriba y abajo. Al ras, la pieza se ve más grande y
            además ocupa menos alto — y cuanto menos alto ocupa, más tramo de
            scroll queda para que el trazo se desarrolle. */}
        <div className="cometa relative aspect-[16/10] w-full overflow-hidden">
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
      </div>
    </div>
  );
}
