/**
 * El fondo del panel de bodas: avanzar entre los bancos.
 *
 * El marco crece y la nave se queda. Las columnas, el púlpito y los bancos con
 * los invitados se agrandan y se abren hacia los costados, mientras la bóveda y
 * el altar se mantienen quietos al fondo. Que una parte no se mueva es lo que
 * hace que la otra se note.
 *
 * El problema de siempre acá son los pilares: están en el marco y también en la
 * foto de abajo, así que cuando el marco se agranda su borde interno se aleja y
 * detrás asoma la copia. Desenfocar la foto de abajo no alcanza —lo que hay ahí
 * es un pilar iluminado, y desenfocado queda una franja clara que se ve peor que
 * el pilar duplicado—.
 *
 * La salida es que abajo haya iglesia de verdad esperando. La nave va dibujada
 * fija a la misma escala a la que el marco va a llegar, así que su contenido ya
 * está donde el marco lo va a descubrir: al principio queda escondido debajo del
 * marco y a medida que el marco se abre lo va destapando. No hay banda que tapar
 * porque no hay banda — los dos bordes coinciden a lo largo de todo el recorrido.
 *
 * Debajo de todo va la foto entera, chica y desenfocada. No es un plano: es un
 * seguro contra la costura de un píxel que podría quedar entre los dos recortes.
 * Por eso pesa un kilobyte y no medio mega.
 */

/** El cuadro del que salieron los dos planos. */
const PROPORCION = "6465/3637";

/**
 * Hacia dónde avanza la cámara: los novios.
 *
 * Es el punto de fuga de la arquitectura y el sujeto de la foto a la vez, que en
 * una toma así son el mismo lugar.
 */
const NOVIOS = "50.2% 74%";

/**
 * Hasta dónde crece el marco.
 *
 * La nave se dibuja fija a este mismo número, y ahí está todo el truco: su borde
 * queda exactamente donde el marco va a terminar, así que lo que el marco
 * descubre al abrirse es iglesia y no vacío. Cambiar uno sin el otro abre la
 * franja de nuevo.
 */
const LLEGADA = 1.15;

export function FondoBoda() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* El lienzo mantiene la proporción del cuadro y crece hasta tapar el
          panel. El ancho mínimo acompaña al alto: 100svh por 1,7776 son 178svh,
          y el `max` cubre el `min-height` del panel en una ventana muy baja. */}
      <div
        className="absolute top-1/2 left-1/2 w-full min-w-[max(178svh,53.3rem)] -translate-x-1/2 -translate-y-1/2"
        style={{ aspectRatio: PROPORCION }}
      >
        {/* El seguro contra costuras. Nunca se ve. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fondos/boda-fondo.webp"
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full"
        />

        {/* La nave: bóveda, altar y los novios. Quieta, pero dibujada ya a la
            escala a la que va a llegar el marco. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fondos/boda-nave.webp"
          alt=""
          decoding="async"
          className="absolute"
          style={{
            left: "18.546%",
            top: "0%",
            width: "62.908%",
            transformOrigin: NOVIOS_NAVE,
            transform: `scale(${LLEGADA})`,
          }}
        />

        {/* El marco: columnas, púlpito y bancos. Es lo único que se mueve. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fondos/boda-frente.webp"
          alt=""
          decoding="async"
          className="plano-acerca absolute inset-0 h-full w-full"
          style={{ transformOrigin: NOVIOS, ["--acerca" as string]: LLEGADA }}
        />

        {/* El mismo marco otra vez, apagado, apareciendo por opacidad mientras
            crece. Se va a la sombra a medida que pasa al lado tuyo, que es lo que
            hace un primer plano cuando la luz queda atrás. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fondos/boda-frente.webp"
          alt=""
          decoding="async"
          className="plano-sombra absolute inset-0 h-full w-full"
          style={{ transformOrigin: NOVIOS, ["--acerca" as string]: LLEGADA }}
        />
      </div>
    </div>
  );
}

/**
 * El mismo punto de los novios, escrito en las coordenadas del recorte de la
 * nave — que está corrido y es más angosto que el cuadro.
 */
const NOVIOS_NAVE = "50.31% 73.99%";
