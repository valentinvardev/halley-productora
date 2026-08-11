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
 * El archivo viene con muchísimo aire: en 1280x720 el dibujo entra en 210x224,
 * o sea el 16% del ancho. Mostrado entero, el logo queda diminuto por más grande
 * que sea la pieza. Así que se recorta al dibujo y nada más: el video se agranda
 * y se corre dentro de la caja hasta que la ventana caiga justo sobre él. El
 * dibujo pasa a ocupar el 75% de la pieza en vez del 16%, sin que la pieza ocupe
 * un píxel más.
 *
 * Por eso la caja es cuadrada: el dibujo lo es. Antes era apaisada como el
 * archivo, y eso sólo servía cuando se mostraba el archivo entero.
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

/**
 * Cuánto se corre el video adentro de la caja, en fracción del alto de la caja.
 *
 * Va en fracción y no en píxeles, y eso importa. El recorte deja 28 píxeles de
 * fuente de margen sobre el cometa; el corrimiento, si es fijo en píxeles de
 * pantalla, vale cada vez más fuente cuanto más chica sea la caja. Con 56 px
 * fijos, en un teléfono se comía 51 de esos 28 y le cortaba la punta al cometa.
 * En fracción del alto se come siempre lo mismo: 0,14 son ±7% de la caja, ±20
 * píxeles de fuente, y los 28 de margen alcanzan en cualquier tamaño.
 */
const RECORRIDO_PARALLAX = 0.14;

/**
 * El tramo de scroll del dibujo, medido en pantallas y no en secciones.
 *
 * Que el tramo se mida contra la ventana es el punto: antes se medía contra la
 * sección, así que la sección tenía que ser altísima —una pantalla y media— sólo
 * para darle recorrido al dibujo, y ese alto de más se veía como un hueco enorme
 * alrededor del texto.
 *
 * Hay dos anclajes, y cuál se usa depende de dónde esté la pieza.
 *
 * En escritorio va al costado del texto, fuera del flujo, y el trazo se reparte
 * entre el primer píxel de scroll y el momento en que la sección termina de
 * entrar en pantalla. Las dos puntas se miden contra el documento, así que no
 * hay número que mantener: cambia el alto del hero o el del texto y el recorrido
 * se acomoda. Antes se anclaba a la ventana igual que en el teléfono, y con eso
 * el dibujo venía un 39% hecho antes de que nadie tocara nada y recién terminaba
 * cuando la sección ya se estaba yendo.
 *
 * En el teléfono la pieza tiene su propia fila arriba del título, mucho más abajo
 * en la página. Ahí se sigue midiendo contra la ventana: el trazo arranca con la
 * pieza `BAJO_EL_PLIEGUE` pantallas por debajo del borde de abajo —o sea, todavía
 * sin verse— y termina cuando al borde de abajo de la pieza le queda `REMATE` de
 * pantalla por arriba. El remate no es cero para que el logo terminado se quede a
 * la vista en vez de completarse justo cuando se va.
 *
 * Arrancar antes de que se vea es de donde sale la lentitud, y no es un rodeo:
 * el techo lo pone la geometría. La pieza sólo se dibuja mientras se la ve, y eso
 * dura una pantalla más su propio alto. Contra ese techo no hay reparto que
 * alcance. Arrancando antes, el cometa entra en pantalla ya volando y el resto se
 * reparte sobre un recorrido más largo.
 *
 * El límite de cuánto antes lo pone el propio cometa: si arranca demasiado antes,
 * para cuando la pieza asoma el cometa ya pasó y sólo se ve dibujarse el
 * barrilete. Volando es cuando vale la pena mirarlo. A 0,6 pantallas el cometa
 * asoma con la mitad del trazo puesto: ahí ya está al filo. Eso vale para el
 * teléfono, que es donde este anclaje sigue en uso.
 *
 * `REMATE` es también la perilla de la velocidad, y por eso está tan arriba: subir
 * el remate acorta el recorrido sin mover el arranque, o sea que el mismo dibujo
 * se resuelve en menos scroll. Como el recorrido también depende del alto de la
 * pieza, cada vez que la pieza cambia de tamaño hay que recalcularlo si se quiere
 * conservar el ritmo.
 *
 * El total es `(ARRANQUE - REMATE)` pantallas más el alto de la pieza, así que
 * una pieza más alta también estira el recorrido.
 */
const BAJO_EL_PLIEGUE = 0.6;
const ARRANQUE = 1 + BAJO_EL_PLIEGUE;
const REMATE = 0.507;

/**
 * Cuánto se corre la pieza entera, hacia abajo, a lo largo del recorrido.
 *
 * Es la única forma de ganar lentitud sin agrandar nada. La pieza sólo se dibuja
 * mientras está a la vista, y eso dura una pantalla más su propio alto: ése es el
 * techo. Corriéndola hacia abajo a medida que se scrollea, la pieza se resiste a
 * irse y el techo sube justo lo que se corre.
 *
 * Sale sólo cuando la pieza está fuera del flujo. En el flujo se llevaría por
 * delante al texto de abajo, que está a cuarenta píxeles.
 */
const DERIVA = 240;

/**
 * Cómo se reparte el scroll sobre el tiempo del video.
 *
 * El archivo reparte pésimo su propio tiempo: el 15% del principio es negro, y
 * de la mitad en adelante casi no cambia nada —sólo aparece "AUDIOVISUAL"—. Todo
 * el dibujo pasa entre el 15% y el 46%. Repartido pareja contra el scroll, eso
 * significa que la parte que se mira ocupa un tercio del recorrido y se resuelve
 * en un pestañeo, mientras dos tercios del scroll no muestran nada.
 *
 * Estos puntos lo enderezan: al tramo que dibuja se le da casi todo el scroll y
 * al resto lo que sobra. Junto con arrancar antes y con la deriva de la pieza,
 * es lo que da lentitud sin pedirle un píxel más de alto a la sección.
 *
 * Cada par es (fracción del scroll, fracción del video); entre punto y punto se
 * interpola derecho.
 */
const REPARTO = [
  [0, 0.13],
  [0.94, 0.47],
  [1, 1],
] as const;

/** El momento del video que le toca a un avance del scroll. */
function momento(avance: number) {
  let i = 1;
  while (i < REPARTO.length - 1 && avance > REPARTO[i]![0]) i++;
  const [desdeScroll, desdeVideo] = REPARTO[i - 1]!;
  const [hastaScroll, hastaVideo] = REPARTO[i]!;
  const t = (avance - desdeScroll) / (hastaScroll - desdeScroll);
  return desdeVideo + (hastaVideo - desdeVideo) * Math.min(Math.max(t, 0), 1);
}

/**
 * Cuánto se estira el recorrido más allá de que la sección entre entera.
 *
 * Terminar justo cuando entra sale un poco seco: el trazo llega al final en el
 * mismo momento en que uno baja la vista al texto. Un poco de más y el logo
 * termina de dibujarse con la sección ya quieta delante.
 */
const HOLGURA = 1.15;

/**
 * Cuánto se acerca el video a su objetivo en cada cuadro.
 *
 * Sin esto, cada golpe de rueda salta varios cuadros de una y el dibujo se ve a
 * los tirones. Persiguiendo el objetivo de a poco, el trazo avanza continuo
 * aunque el scroll llegue a los saltos.
 */
const SUAVIDAD = 0.055;

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
    /** Cuánto se le corrió a la pieza; hay que descontarlo al medirla. */
    let corrida = 0;
    /** Si está fuera del flujo puede correrse sin llevarse nada por delante. */
    let suelta = false;
    /** El alto de la caja: el corrimiento del video se mide contra él. */
    let alto = 0;

    const ubicar = () => {
      suelta = getComputedStyle(m).position === "absolute";
    };

    const medir = () => {
      const caja = m.getBoundingClientRect();
      const ventana = window.innerHeight;
      const recorrido = suelta ? DERIVA : 0;

      // Se descuenta lo que ya se le corrió: si no, el corrimiento entraría en
      // su propia medición y se perseguiría a sí mismo.
      const arriba = caja.top - corrida;

      let crudo: number;
      if (suelta) {
        // Escritorio, con la pieza al costado del texto. El trazo va del primer
        // píxel de scroll hasta que la sección termina de entrar en pantalla,
        // que es el momento en que uno se pone a leerla: para entonces el logo
        // ya tiene que estar dibujado.
        //
        // Las dos puntas se miden solas contra el documento, así que no hay
        // números que mantener: si el hero cambia de alto o la sección de
        // contenido, el recorrido se acomoda.
        const seccion = m.parentElement?.getBoundingClientRect();
        const entrada = seccion
          ? seccion.bottom + window.scrollY - ventana
          : ventana;
        crudo = window.scrollY / Math.max(1, entrada * HOLGURA);
      } else {
        // Teléfono, con la pieza en su propia fila arriba del título. Acá está
        // mucho más abajo en la página: anclarla al scroll le daría un recorrido
        // larguísimo y el trazo terminaría mucho antes de que se la vea. Se mide
        // contra la ventana, que es lo que la trae a la vista.
        const desde = ARRANQUE * ventana;
        const hasta = REMATE * ventana - caja.height - recorrido;
        crudo = (desde - arriba) / Math.max(1, desde - hasta);
      }

      avance = Math.min(Math.max(crudo, 0), 1);
      corrida = (avance - 0.5) * recorrido;
      alto = caja.height;
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
        const t = Math.min(momento(actual) * dur, dur - 0.05);
        if (Math.abs(v.currentTime - t) > 0.005) v.currentTime = t;
      }

      // Los dos corrimientos van sin suavizado: son desplazamientos, y
      // arrastrarlos se sentiría como que la pieza flota despegada del papel.
      // El de la pieza va en `transform` y el centrado de Tailwind en
      // `translate`, que son propiedades distintas: se componen sin pisarse.
      m.style.transform = corrida ? `translate3d(0, ${corrida}px, 0)` : "";

      if (capa.current) {
        const corrimiento = (0.5 - avance) * RECORRIDO_PARALLAX * alto;
        capa.current.style.transform = `translate3d(0, ${corrimiento}px, 0)`;
      }
    };

    const alScrollear = () => {
      medir();
      pedido ||= requestAnimationFrame(pintar);
    };

    const alRedimensionar = () => {
      ubicar();
      alScrollear();
    };

    // El teléfono no bufferea un video que nunca se reprodujo, y sin datos
    // `currentTime` no se mueve: el video se queda clavado en el primer cuadro,
    // que es negro. Invertido sobre papel casi blanco eso es invisible, así que
    // el logo directamente no aparecía. Un play seguido de pause lo obliga a
    // decodificar; queda mudo y en línea, que es lo que la política de
    // reproducción automática pide. Si la rechaza igual, el póster —el logo
    // terminado— es lo que queda a la vista, que es un final aceptable.
    const despertar = () => {
      const promesa = v.play();
      if (promesa) void promesa.then(() => v.pause()).catch(() => undefined);
    };

    ubicar();
    medir();
    actual = avance;
    if (v.readyState >= 1) {
      despertar();
      pintar();
    } else {
      v.addEventListener(
        "loadedmetadata",
        () => {
          despertar();
          pintar();
        },
        { once: true },
      );
    }

    window.addEventListener("scroll", alScrollear, { passive: true });
    window.addEventListener("resize", alRedimensionar);
    return () => {
      window.removeEventListener("scroll", alScrollear);
      window.removeEventListener("resize", alRedimensionar);
      if (pedido) cancelAnimationFrame(pedido);
    };
  }, []);

  return (
    // Una sola caja, del tamaño de la pieza. Antes había otra por fuera que
    // abarcaba la sección entera: era la que le medía el scroll al dibujo, y ya
    // no hace falta porque el recorrido se mide contra la ventana.
    //
    // Cuadrada, como el dibujo. La caja es la ventana del recorte: adentro el
    // video va agrandado y corrido hasta que el dibujo quede justo acá.
    //
    // Cómo se ubica lo decide quien la usa, porque cambia con el ancho: en el
    // flujo cuando tiene que ocupar una fila propia, fuera del flujo cuando va
    // en un hueco del fondo. Lo único que la pieza necesita es estar posicionada
    // —la capa del parallax se cuelga de ella—, así que va `relative` de mínima.
    <div
      ref={marco}
      aria-hidden="true"
      className={`cometa pointer-events-none relative aspect-square overflow-hidden ${className}`}
    >
      {/* La capa mide lo mismo que la caja. Antes se le daba alto de más para
          que el parallax no descubriera un borde al correrse; ahora el video
          asoma por los cuatro lados mucho más que ese corrimiento y alcanza. */}
      <div ref={capa} className="absolute inset-0 will-change-transform">
        {/* El recorte, en porcentajes de la caja.
            Medido sobre todo lo que el video pinta alguna vez, el dibujo entra
            en 210x224 de los 1280x720 del archivo. El recorte es el cuadrado de
            280 con la esquina en (523, 224): deja unos treinta píxeles de aire
            alrededor y nada más. Para que ese cuadrado llene la caja, el video
            tiene que medir 1280/280 y 720/280 de ella —457,14% y 257,14%— y
            correrse 523/280 y 224/280 —186,79% y 80%—. Como la caja es cuadrada,
            los porcentajes de arriba y de la izquierda se resuelven contra el
            mismo lado y la cuenta cierra sola.
            `max-w-none` porque Tailwind le pone `max-width:100%` a `img` y
            `video`, y sin sacarlo el recorte no se agranda nada. */}
        {quieto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/marca/logo-animado.jpg"
            alt="Halley Audiovisual"
            className="absolute top-[-80%] left-[-186.79%] h-[257.14%] w-[457.14%] max-w-none object-cover"
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
            preload="metadata"
            aria-hidden="true"
            className="absolute top-[-80%] left-[-186.79%] h-[257.14%] w-[457.14%] max-w-none object-cover"
          />
        )}
      </div>
    </div>
  );
}
