/**
 * El fondo del panel de egresados: el curso viene hacia vos.
 *
 * Tres planos. Atrás la foto entera; al medio el curso festejando, con la chica
 * en andas; adelante dos manos levantadas, que en la toma ya vienen fuera de
 * foco de lo cerca que están del lente.
 *
 * El que más crece es el curso. Las manos casi no se mueven, y eso —que parece
 * al revés, porque son lo más cercano— es lo correcto acá: esas manos son las de
 * quien mira. Uno camina hacia adelante y sus propias manos se quedan donde
 * estaban en el cuadro; lo que se agranda es aquello hacia lo que va.
 *
 * Además es lo único que se ve bien, y por un motivo que apareció probando. Atrás
 * va la foto entera —como en bodas, para que al separarse los planos nunca quede
 * un vacío—, pero eso tiene una contra: lo que hay debajo de un recorte es ese
 * mismo recorte sin mover. Un plano ancho tapa su propia copia mientras se
 * agranda; una mano no, es fina y aislada, y a partir de cierto corrimiento se ve
 * doble. A 1,32 y a 1,15 la mano derecha salía duplicada. A 1,05 no.
 *
 * Con el curso pasa lo mismo y no se arregla agrandándolo. Su silueta tiene
 * huecos —entre los brazos levantados, entre las cabezas— y al alejarse del
 * punto de fuga esos huecos se abren y dejan ver la copia de abajo. Agrandarlo
 * más los abre más: probado a 1,24 y la manga con la franja amarilla se veía dos
 * veces.
 *
 * Lo que sí lo arregla es que el fondo se vaya de foco. Lo que asoma por los
 * huecos deja de leerse como una copia y pasa a leerse como lo que en la foto ya
 * es: gente lejos, fuera de foco. Y encima cierra la profundidad que la toma ya
 * tenía, porque las manos de adelante también vienen desenfocadas.
 *
 * Va progresivo y no fijo: el fondo arranca nítido —la foto se ve como es— y se
 * difumina al mismo ritmo que los planos se separan, que es cuando la
 * duplicación aparece. El desenfoque llega junto con el problema que tapa.
 *
 * No se calcula en vivo. `filter: blur()` obliga a redibujar en cada cuadro y a
 * pantalla completa se siente; una copia borrosa encima que aparece por opacidad
 * la resuelve el compositor sola.
 *
 * La copia no sólo va desenfocada: va desaturada casi hasta el gris y después
 * teñida de amarillo claro, con el brillo subido. El orden importa. Teñir sin
 * desaturar primero daba un oliva sucio, porque el verde de la cancha domina el
 * cuadro y al sacarle azul se va al lima. Llevado a gris antes, el tinte entra
 * parejo y queda una bruma crema.
 *
 * Contra esa bruma clara y fría de detalle, el granate de las camperas y los
 * tonos de piel del recorte saltan mucho más que contra la foto original, que es
 * cálida y llena de cosas y les competía.
 *
 * Y como el filtro va horneado en la copia que aparece por opacidad, entra
 * progresivo sin costar una capa ni una animación más: es la misma que ya se
 * estaba revelando.
 *
 * El desenfoque es fuerte a propósito —ciento ochenta píxeles a pantalla
 * completa— y no lo justo para disimular. Cuanto más lejos queda el fondo, más se
 * despega de él el recorte nítido, y la duplicación deja de ser algo que se
 * disimula para pasar a ser algo que no se puede ver. Del fondo no queda ni el
 * rastro del balcón; a cambio el curso queda solo en el cuadro, que es de lo que
 * la foto habla.
 *
 * A ese desenfoque la copia puede ir muy chica sin que se note: va a 320 de ancho
 * y pesa poco más de un kilobyte, contra los 124 de la nítida.
 */

/** El cuadro del que salieron los tres planos. */
const PROPORCION = "1620/911";

/**
 * Los planos, del fondo hacia adelante — es el orden en que se pintan.
 *
 * `izq`, `arriba` y `ancho` ubican cada recorte dentro del cuadro original, en
 * porcentaje. `origen` es el punto hacia el que se avanza —la cara de la chica—
 * visto desde ese recorte, así que es el mismo punto de la foto escrito en las
 * coordenadas de cada uno. `acerca` es cuánto crece al final del recorrido.
 */
const PLANOS = [
  {
    archivo: "/fondos/egresados-fondo.webp",
    izq: "0%",
    arriba: "0%",
    ancho: "100%",
    origen: "52.59% 41.71%",
    acerca: 1.02,
  },
  {
    // La misma foto borrosa, encima de la nítida y apareciendo por opacidad.
    // Escala igual que ella para que no se despeguen entre sí.
    archivo: "/fondos/egresados-fondo-suave.webp",
    izq: "0%",
    arriba: "0%",
    ancho: "100%",
    origen: "52.59% 41.71%",
    acerca: 1.02,
    difumina: true,
  },
  {
    archivo: "/fondos/egresados-grupo.webp",
    izq: "0%",
    arriba: "3.732%",
    ancho: "87.407%",
    // Desde su propio centro y no desde el punto de fuga común. Creciendo en el
    // lugar, el recorte tapa su propia copia del fondo en vez de correrse a un
    // costado y dejarla asomar, que es lo que hacía que el brazo se viera doble.
    origen: "50% 50%",
    acerca: 1.16,
  },
  {
    archivo: "/fondos/egresados-manos.webp",
    izq: "5.864%",
    arriba: "12.294%",
    ancho: "93.765%",
    // Éstas sí se van hacia afuera, desde la cara de la chica: son lo más cerca
    // del lente y es lo que uno deja pasar al avanzar. Pueden hacerlo porque lo
    // que descubren al correrse es el fondo desenfocado, donde su propia copia
    // es una mancha suave y no una mano.
    origen: "49.84% 33.54%",
    acerca: 1.3,
  },
];

export function FondoEgresados() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* El lienzo mantiene la proporción del cuadro y crece hasta tapar el
          panel. Mientras la conserve, los tres planos calzan entre sí solos:
          todos están ubicados en porcentajes del mismo cuadro. */}
      <div
        className="absolute top-1/2 left-1/2 w-full min-w-[max(89svh,26rem)] lg:min-w-[max(93svh,27rem)] -translate-x-1/2 -translate-y-1/2"
        style={{ aspectRatio: PROPORCION }}
      >
        {PLANOS.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.archivo}
            src={p.archivo}
            alt=""
            decoding="async"
            className={`plano-acerca absolute max-w-none ${
              p.difumina ? "plano-difumina" : ""
            }`}
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
