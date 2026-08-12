/**
 * El fondo del panel de bodas: subir por el pasillo.
 *
 * La nave es una perspectiva de un solo punto y ese punto son los novios. La
 * animación avanza hacia ellos: los bancos y las columnas de los costados —el
 * primer plano— crecen mucho y se van de cuadro por los lados, mientras la nave
 * crece apenas. Ese desfasaje entre velocidades es lo que el ojo lee como cámara
 * avanzando, y acá es literalmente caminar hacia el altar.
 *
 * Son dos planos, y el de atrás es la foto entera y no un recorte. Eso importa:
 * cuando el primer plano se agranda, su borde interno se aleja del punto de fuga
 * y descubre lo que hay debajo. Con un recorte complementario —lo que uno tapa,
 * el otro no lo tiene— ahí quedaría un vacío. Con la foto entera abajo siempre
 * hay iglesia, y como lo que asoma es la misma imagen a una escala casi igual,
 * no se lee ni como fantasma ni como costura.
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
        {/* Los bancos y las columnas, recortados. Crecen cuatro veces más y se
            van por los costados: es lo que uno deja atrás al caminar. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fondos/boda-frente.webp"
          alt=""
          decoding="async"
          className="plano-acerca absolute inset-0 h-full w-full"
          style={{ transformOrigin: NOVIOS, ["--acerca" as string]: 1.2 }}
        />
      </div>
    </div>
  );
}
