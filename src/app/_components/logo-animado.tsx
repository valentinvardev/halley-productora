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
 * En qué parte del recorrido empieza y termina el dibujo.
 *
 * No se usa la pista entera: arrancar apenas asoma la sección y terminar justo
 * al irse deja el logo formado sólo un instante. Con estos márgenes el dibujo
 * ocupa el tramo del medio —cuando la pieza está bien a la vista— y llega al
 * final con sección de sobra para que se lo pueda mirar terminado.
 */
const DESDE = 0.12;
const HASTA = 0.78;

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

      // La pista es todo el alto de la sección, no el de la pieza: como la pieza
      // queda pegada mientras la sección pasa, el dibujo dispone de todo ese
      // scroll en vez de los pocos cientos de píxeles que tarda un elemento
      // suelto en cruzar la pantalla. Ahí estaba lo apurado.
      const recorrido = alto * 0.5 - caja.top;
      const crudo = Math.min(Math.max(recorrido / caja.height, 0), 1);

      // Se reencuadra al tramo útil, con márgenes antes y después.
      const util = (crudo - DESDE) / (HASTA - DESDE);
      avance = Math.min(Math.max(util, 0), 1);
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
      <div className="sticky top-0 flex h-svh items-center">
        <div className="cometa relative aspect-square w-full overflow-hidden">
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
