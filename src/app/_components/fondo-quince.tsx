/**
 * El fondo del panel de quince: una foto abierta en planos, que se acerca.
 *
 * La foto es un pasillo —los floreros a izquierda y derecha enmarcan el camino
 * hasta la quinceañera—, así que el efecto es avanzar por él. Cada plano crece a
 * distinta velocidad: los de adelante mucho, el salón del fondo casi nada. Ese
 * desfasaje entre velocidades es lo que el ojo lee como movimiento de cámara.
 *
 * Los planos se recortaron de una sola foto, así que detrás de cada uno no
 * había nada, y el fondo quedaba con los huecos de todo lo que se le sacó
 * adelante. Eso obliga a que el fondo sea macizo, y hay un motivo que no es
 * obvio: al escalar, una silueta se aleja del punto de fuga por los dos lados a
 * la vez. Tapa más por afuera —eso se ve venir— pero por adentro se corre y
 * destapa. Justo el borde interno de las arañas es donde el hueco se abría.
 *
 * Así que abajo siempre tiene que haber salón. El que se usa no es el recorte
 * original sino uno rellenado, y el relleno importa porque se ve: el primero,
 * generado, dejaba nubes grises más grandes que las siluetas y eran exactamente
 * lo que asomaba. El que quedó rellena los huecos con el entorno desenfocado,
 * que es lo que ahí habría estado de verdad: fondo fuera de foco.
 *
 * Por eso todos crecen desde el mismo punto de fuga —la quinceañera— y no desde
 * su propio centro. Como cada archivo viene recortado a su caja, ese punto cae
 * en un lugar distinto dentro de cada uno, y de ahí salen los `origen` de la
 * tabla: son el mismo punto de la foto, escrito en las coordenadas de cada
 * recorte.
 */

/** El cuadro del que salieron todos los planos. */
const PROPORCION = "1620/1080";

/**
 * Los planos, del fondo hacia adelante — es el orden en que se pintan.
 *
 * `izq`, `arriba` y `ancho` ubican cada recorte dentro del cuadro original, en
 * porcentaje. `origen` es el punto de fuga visto desde ese recorte. `acerca` es
 * cuánto crece al final del recorrido: más cerca, más crece.
 */
const PLANOS = [
  {
    // Macizo y a cuadro completo, por lo de arriba. Los huecos van rellenos con
    // el propio entorno desenfocado y un punto más oscuro, así que lo que asoma
    // entre los planos se lee como fondo fuera de foco y no como parche.
    archivo: "/fondos/quince-salon.webp",
    izq: "0%",
    arriba: "0%",
    ancho: "100%",
    origen: "49.10% 53.56%",
    acerca: 1.02,
  },
  {
    archivo: "/fondos/quince-quinceanera.webp",
    izq: "42.901%",
    arriba: "43.148%",
    ancho: "12.407%",
    origen: "50% 50%",
    acerca: 1.05,
  },
  {
    archivo: "/fondos/quince-mesa.webp",
    izq: "0%",
    arriba: "45%",
    ancho: "100%",
    origen: "49.10% 15.57%",
    acerca: 1.12,
  },
  {
    archivo: "/fondos/quince-velas.webp",
    izq: "34.691%",
    arriba: "36.944%",
    ancho: "33.210%",
    origen: "43.40% 43.67%",
    acerca: 1.16,
  },
  {
    archivo: "/fondos/quince-lamparas.webp",
    izq: "0%",
    arriba: "0%",
    ancho: "97.963%",
    origen: "50.13% 56.66%",
    acerca: 1.22,
    // Además de crecer, sube. Los floreros están abajo a la izquierda del punto
    // de fuga, así que al agrandarse se corren hacia abajo y destapan por arriba
    // el relleno que el salón tiene donde ellos estaban: una mancha oscura que
    // se nota. Subiendo mientras crecen la vuelven a tapar. Va progresivo como
    // el resto, así que al principio la foto está tal cual.
    sube: "-6%",
  },
];

export function FondoQuince() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* El lienzo tiene la proporción exacta del cuadro original y crece hasta
          tapar el panel. Mientras la conserve, los planos calzan entre sí solos:
          cada uno está ubicado en porcentajes del mismo cuadro. El ancho mínimo
          acompaña al alto del panel — 100svh por la proporción 1,5 son 150svh. */}
      <div
        className="absolute top-1/2 left-1/2 w-full min-w-[max(150svh,45rem)] -translate-x-1/2 -translate-y-1/2"
        style={{ aspectRatio: PROPORCION }}
      >
        {PLANOS.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.archivo}
            src={p.archivo}
            alt=""
            decoding="async"
            className="plano-acerca absolute max-w-none"
            style={{
              left: p.izq,
              top: p.arriba,
              width: p.ancho,
              transformOrigin: p.origen,
              ["--acerca" as string]: p.acerca,
              ...("sube" in p ? { ["--sube" as string]: p.sube } : {}),
            }}
          />
        ))}
      </div>
    </div>
  );
}
