/**
 * El fondo del panel de bodas: subir por el pasillo.
 *
 * La nave es una perspectiva de un solo punto y ese punto son los novios. La
 * animación avanza hacia ellos: los bancos y las columnas de los costados —el
 * primer plano— crecen mucho y se van de cuadro por los lados, mientras la nave
 * crece apenas. Ese desfasaje entre velocidades es lo que el ojo lee como cámara
 * avanzando, y acá es literalmente caminar hacia el altar.
 *
 * Son tres planos y el de atrás es la foto entera, no un recorte. Cuando un
 * plano se agranda, su borde interno se aleja del punto de fuga y descubre lo
 * que hay debajo; con recortes complementarios —lo que uno tapa, el otro no lo
 * tiene— ahí quedaría un vacío, y con la foto entera abajo siempre hay iglesia.
 *
 * Pero la foto entera trae su propio problema: adentro están los mismos pilares
 * que se ven en el plano de adelante, así que al separarse se veían dos veces.
 * Por eso la nave va como plano intermedio y crece un poco más que el frente:
 * al agrandarse tapa los pilares de la foto de abajo antes de que asomen. Que
 * crezca más que algo que está delante suyo es raro de leer escrito, pero acá
 * el resultado es el correcto y la diferencia es de cuatro centésimas.
 *
 * Se probó antes con un cambio de foco —entrar enfocando los bancos y llevar el
 * foco al altar— y no funcionó: el desenfoque sin movimiento se lee como una
 * foto mal tomada, no como una decisión. El zoom dice lo mismo y se ve.
 */

/** El cuadro del que salieron los dos planos. */
const PROPORCION = "6465/3637";

/**
 * Hacia dónde avanza la cámara: los novios.
 *
 * Los dos planos crecen desde este punto, no desde su propio centro. Es el punto
 * de fuga de la arquitectura y el sujeto de la foto a la vez, que en una toma
 * así son el mismo lugar.
 */
const NOVIOS = "50.2% 74%";

export function FondoBoda() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* El lienzo mantiene la proporción del cuadro y crece hasta tapar el
          panel. El ancho mínimo acompaña al alto: 100svh por 1,7776 son 178svh. */}
      <div
        className="absolute top-1/2 left-1/2 w-full min-w-[178svh] -translate-x-1/2 -translate-y-1/2"
        style={{ aspectRatio: PROPORCION }}
      >
        {/* La foto entera, atrás. Crece poco: es lo lejano. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fondos/boda-fondo.webp"
          alt=""
          decoding="async"
          className="plano-acerca absolute inset-0 h-full w-full"
          style={{ transformOrigin: NOVIOS, ["--acerca" as string]: 1.045 }}
        />
        {/* La nave: bóveda, altar y los novios. Va entre los dos, y crece lo
            justo para taparle a la foto de abajo los pilares que comparte con el
            plano de adelante. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fondos/boda-nave.webp"
          alt=""
          decoding="async"
          className="plano-acerca absolute"
          style={{
            left: "18.546%",
            top: "0%",
            width: "62.908%",
            transformOrigin: "50.31% 73.99%",
            ["--acerca" as string]: 1.22,
          }}
        />

        {/* Los bancos y las columnas, recortados. Se van por los costados: es lo
            que uno deja atrás al caminar. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fondos/boda-frente.webp"
          alt=""
          decoding="async"
          className="plano-acerca absolute inset-0 h-full w-full"
          style={{ transformOrigin: NOVIOS, ["--acerca" as string]: 1.18 }}
        />
      </div>
    </div>
  );
}
