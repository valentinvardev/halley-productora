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
 * Además es lo único que se ve bien, y por un motivo concreto. Atrás va la foto
 * entera —como en bodas, para que al separarse los planos nunca quede un vacío—,
 * pero eso tiene una contra: lo que hay debajo de un recorte es ese mismo
 * recorte sin mover. Un plano ancho tapa su propia copia mientras se agranda; una
 * mano no, es fina y aislada, y a partir de cierto corrimiento se ve doble. A
 * 1,32 y a 1,15 la mano derecha salía duplicada. A 1,05 no.
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
    archivo: "/fondos/egresados-grupo.webp",
    izq: "0%",
    arriba: "3.732%",
    ancho: "87.407%",
    origen: "60.17% 39.45%",
    acerca: 1.14,
  },
  {
    archivo: "/fondos/egresados-manos.webp",
    izq: "5.864%",
    arriba: "12.294%",
    ancho: "93.765%",
    origen: "49.84% 33.54%",
    acerca: 1.05,
  },
];

export function FondoEgresados() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* El lienzo mantiene la proporción del cuadro y crece hasta tapar el
          panel. Mientras la conserve, los tres planos calzan entre sí solos:
          todos están ubicados en porcentajes del mismo cuadro. */}
      <div
        className="absolute top-1/2 left-1/2 w-full min-w-[178svh] -translate-x-1/2 -translate-y-1/2"
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
            }}
          />
        ))}
      </div>
    </div>
  );
}
