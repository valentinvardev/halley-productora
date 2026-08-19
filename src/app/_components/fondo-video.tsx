"use client";

import { useEffect, useRef } from "react";

/**
 * La portada de una categoría, en video.
 *
 * Reemplaza al armado por capas. Aquello recortaba una foto en planos y los
 * separaba con CSS para simular el avance de la cámara, y se peleaba siempre
 * contra lo mismo: debajo de un recorte está el mismo recorte sin mover, así
 * que al separarse aparecía la copia. Media docena de decisiones —el punto de
 * fuga común, el fondo desenfocado, las arañas partidas al medio— existían para
 * disimular eso. Con el movimiento ya rendido en video el problema no existe:
 * lo que se ve es la toma real moviéndose.
 *
 * El disparo es el mismo que el de las tarjetas que no tienen video: el cursor
 * en escritorio, entrar en pantalla en el teléfono. Y se lee del mismo lugar
 * —la tarjeta— en vez de recibirlo por props, así que la regla de cuándo se
 * anima sigue estando en un solo sitio aunque el cómo sea distinto.
 *
 * Al salir el cursor rebobina en vez de cortar. Un video que vuelve de golpe al
 * cuadro uno se lee como un error; volviendo hacia atrás se lee como que la
 * cámara retrocede. En el teléfono no rebobina: cuando la tarjeta sale de
 * pantalla no hay nadie mirándola, y seekear cuadro por cuadro en un celular
 * cuesta más de lo que rinde.
 */

/** Cuánto más rápido vuelve de lo que fue. Volver tiene que costar menos. */
const RETROCESO = 1.8;

export function FondoVideo({
  nombre,
  alt,
}: {
  /** El par de archivos: `/fondos/{nombre}-portada.mp4` y `.webp`. */
  nombre: string;
  alt?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  /** El rebobinado en curso, para poder cortarlo si vuelve el cursor. */
  const cuadro = useRef<number | null>(null);

  useEffect(() => {
    const v = video.current;
    const tarjeta = caja.current?.closest(".tarjeta-servicio");
    if (!v || !tarjeta) return;

    // Quien pidió que no se mueva nada se queda con el póster, que es el primer
    // cuadro: la tarjeta se sigue viendo, sólo que quieta.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const frenar = () => {
      if (cuadro.current !== null) cancelAnimationFrame(cuadro.current);
      cuadro.current = null;
    };

    const arrancar = () => {
      frenar();
      void v.play().catch(() => undefined);
    };

    /**
     * Volver al principio yendo para atrás.
     *
     * `playbackRate` no acepta negativos en ningún navegador, así que el
     * retroceso se hace moviendo `currentTime` a mano contra el reloj de los
     * cuadros. Anda porque los clips duran tres o cuatro segundos y para cuando
     * alguien saca el cursor ya están enteros en memoria: buscar dentro de lo
     * que está cargado no vuelve a pedir nada a la red.
     */
    const rebobinar = () => {
      frenar();
      v.pause();
      if (v.currentTime <= 0) return;

      let previo = performance.now();
      const paso = (ahora: number) => {
        const dt = (ahora - previo) / 1000;
        previo = ahora;

        const t = v.currentTime - dt * RETROCESO;
        if (t <= 0) {
          v.currentTime = 0;
          cuadro.current = null;
          return;
        }
        v.currentTime = t;
        cuadro.current = requestAnimationFrame(paso);
      };
      cuadro.current = requestAnimationFrame(paso);
    };

    // Donde hay cursor manda el cursor; donde no lo hay, entrar en pantalla.
    // Es la misma pregunta que hace la tarjeta para las que no tienen video:
    // no cuán grande es la pantalla, sino si hay con qué apuntar.
    if (window.matchMedia("(hover: none)").matches) {
      const mirando = new IntersectionObserver(
        ([entrada]) => {
          if (!entrada) return;
          if (entrada.isIntersecting) arrancar();
          else {
            v.pause();
            v.currentTime = 0;
          }
        },
        { threshold: 0.45 },
      );
      mirando.observe(tarjeta);
      return () => {
        mirando.disconnect();
        frenar();
      };
    }

    tarjeta.addEventListener("pointerenter", arrancar);
    tarjeta.addEventListener("pointerleave", rebobinar);
    return () => {
      tarjeta.removeEventListener("pointerenter", arrancar);
      tarjeta.removeEventListener("pointerleave", rebobinar);
      frenar();
    };
  }, []);

  /**
   * El archivo no se baja hasta que la tarjeta está por verse.
   *
   * Con `preload="none"` no cuesta nada para quien nunca baja hasta acá, y con
   * el margen de doscientos píxeles llega cargado antes de que se pueda tocar,
   * así que el primer hover no espera. Es la diferencia entre medio mega que se
   * baja siempre y medio mega que se baja cuando hace falta.
   */
  useEffect(() => {
    const v = video.current;
    if (!v) return;

    const cerca = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada?.isIntersecting) return;
        v.preload = "auto";
        v.load();
        cerca.disconnect();
      },
      { rootMargin: "200px" },
    );
    cerca.observe(v);
    return () => cerca.disconnect();
  }, []);

  return (
    <div ref={caja} className="absolute inset-0 overflow-hidden">
      <video
        ref={video}
        src={`/fondos/${nombre}-portada.mp4`}
        poster={`/fondos/${nombre}-portada.webp`}
        muted
        playsInline
        preload="none"
        disablePictureInPicture
        disableRemotePlayback
        aria-hidden={alt ? undefined : "true"}
        aria-label={alt}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
