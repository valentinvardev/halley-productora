/**
 * El fondo del panel de bodas: una foto que cambia de foco.
 *
 * La nave de la iglesia es una perspectiva de un solo punto y ese punto son los
 * novios. La foto está entera nítida, como sale de un gran angular cerrado, y lo
 * que se hace acá es devolverle la profundidad de campo que no tuvo: se entra
 * con foco en los bancos —entre los invitados, que es donde uno está sentado— y
 * el foco viaja hasta el altar. Es el movimiento con el que se filma una boda, y
 * acá lo hace el scroll.
 *
 * Se eligió esto y no un acercamiento como el de quince por dos motivos. Uno,
 * repetir el mismo recurso en dos paneles pegados se lee como plantilla. El
 * otro es material: acá hay dos planos y son complementarios —lo que uno tapa,
 * el otro no lo tiene—, así que si se movieran a distinta velocidad se abriría
 * un vacío entre ellos. El foco no mueve nada de lugar, así que ese problema no
 * existe.
 *
 * El acercamiento que sí hay es de la foto entera, los dos planos juntos: como
 * no hay velocidad relativa, tampoco hay vacío que se abra. Aporta la deriva sin
 * pedirle nada al recorte.
 *
 * El desenfoque no se calcula en vivo. `filter: blur()` obliga a redibujar en
 * cada cuadro y a pantalla completa eso se siente; en cambio una copia borrosa
 * encima que aparece por opacidad la resuelve el compositor sola. Y la copia
 * borrosa va a baja resolución a propósito: el desenfoque ya destruyó el
 * detalle, guardarlo grande sería pagar por píxeles que no dicen nada. Las dos
 * suaves pesan 11 KB cada una.
 */

/** El cuadro del que salieron los dos planos. */
const PROPORCION = "6465/3637";

/**
 * Hacia dónde se acerca la cámara: los novios.
 *
 * Es también el punto donde termina de resolver el foco, y no es casualidad —
 * en una toma así el punto de fuga de la arquitectura y el sujeto son el mismo.
 */
const NOVIOS = "50.2% 74%";

/** Dónde cae el recorte de la nave dentro del cuadro. */
const NAVE = { left: "18.546%", top: "0%", width: "62.908%" };

export function FondoBoda() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* El lienzo mantiene la proporción del cuadro y crece hasta tapar el
          panel. Los dos planos se ubican en porcentajes de él, así que calzan
          entre sí en cualquier tamaño. El acercamiento va acá, en el lienzo, no
          en los planos: mueve a los dos juntos. */}
      <div
        className="lienzo-boda absolute top-1/2 left-1/2 w-full min-w-[178svh] -translate-x-1/2 -translate-y-1/2"
        style={{ aspectRatio: PROPORCION, transformOrigin: NOVIOS }}
      >
        {/* La nave: bóveda, altar y los novios. Va atrás. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fondos/boda-nave.webp"
          alt=""
          decoding="async"
          className="absolute"
          style={NAVE}
        />
        {/* Su copia borrosa arranca tapándola entera y se desvanece: eso es el
            foco viajando hacia el altar. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fondos/boda-nave-suave.webp"
          alt=""
          decoding="async"
          className="boda-enfoca absolute"
          style={NAVE}
        />

        {/* El frente: las columnas de los costados y los bancos con los
            invitados. Va adelante y tapa lo que a la nave le falta. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fondos/boda-frente.webp"
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full"
        />
        {/* Al revés que la nave: entra nítido y termina borroso. La copia va
            encima de la nítida, así que donde el desenfoque le comió el borde
            —al difuminarse también se difumina el alfa— vuelve a asomar la
            nítida de abajo en vez de quedar un vacío. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fondos/boda-frente-suave.webp"
          alt=""
          decoding="async"
          className="boda-desenfoca absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}
