/**
 * El fondo del panel de quince: una foto abierta en planos, que se acerca.
 *
 * La foto es un pasillo —los floreros a izquierda y derecha enmarcan el camino
 * hasta la quinceañera—, así que el efecto es avanzar por él. Cada plano crece a
 * distinta velocidad: los de adelante mucho, el salón del fondo casi nada. Ese
 * desfasaje entre velocidades es lo que el ojo lee como movimiento de cámara.
 *
 * Que se acerque y no que se desplace tampoco es un gusto. Los planos se
 * recortaron de una sola foto, así que detrás de cada uno no había nada. El
 * salón se reemplazó por un fondo rellenado —macizo, sin agujeros—, pero los
 * otros cuatro siguen siendo recortes: uno que se corre de lugar descubre el
 * hueco que dejó en su vecino. Uno que se agranda desde el mismo punto tapa
 * siempre más, nunca menos.
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
    // El salón no es el recorte original sino un fondo rellenado: el de la foto
    // tenía los agujeros con la forma de todo lo que se le sacó adelante, y por
    // más que los planos de adelante los tapen, cualquier borde que no calzara
    // al píxel dejaba ver el vacío. Éste es macizo de punta a punta, así que
    // debajo de los cinco planos siempre hay salón y nunca el papel de la
    // página. Por eso también va a cuadro completo y no recortado.
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
        className="lienzo-planos absolute top-1/2 left-1/2 w-full min-w-[150svh] -translate-x-1/2 -translate-y-1/2"
        style={{ aspectRatio: PROPORCION }}
      >
        {PLANOS.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.archivo}
            src={p.archivo}
            alt=""
            decoding="async"
            className="plano-quince absolute max-w-none"
            style={{
              left: p.izq,
              top: p.arriba,
              width: p.ancho,
              transformOrigin: p.origen,
              ["--acerca" as string]: p.acerca,
            }}
          />
        ))}
      </div>
    </div>
  );
}
