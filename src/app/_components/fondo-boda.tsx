/**
 * El fondo del panel de bodas: la iglesia trae el altar.
 *
 * El marco no se mueve. Las columnas, el púlpito y los bancos con los invitados
 * se quedan exactamente donde están, y lo que crece es la nave: la bóveda, el
 * altar y los novios se acercan a través de ese marco quieto. Que una parte no
 * se mueva es lo que hace que la otra se note; con todo moviéndose a la vez sólo
 * había un zoom parejo, que es el efecto más genérico que existe.
 *
 * Y es la única combinación que no puede duplicar nada, que fue el problema de
 * las versiones anteriores. Los dos recortes son complementarios y juntos tapan
 * el cuadro entero, así que: el frente, quieto, nunca descubre su propia copia
 * del fondo; y la nave, al crecer, mete su borde por debajo del frente, que está
 * encima y no se movió. No hay geometría posible donde algo asome dos veces.
 *
 * Debajo va la foto entera, chica y desenfocada. No es un plano: es un seguro
 * contra la costura de un píxel que podría quedar entre los dos recortes al
 * arrancar. Por eso pesa dos kilobytes y no medio mega.
 *
 * El frente además se va apagando. Es la misma imagen otra vez, con un filtro de
 * brillo y apareciendo por opacidad —el filtro se rasteriza una sola vez y lo
 * único animado es la opacidad, que la resuelve el compositor—. No hace falta
 * bajar otro archivo: el navegador ya lo tiene.
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
        {/* El seguro contra costuras. Nunca se ve. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fondos/boda-fondo.webp"
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full"
        />
        {/* La nave: bóveda, altar y los novios. Es lo único que se mueve. */}
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
            ["--acerca" as string]: 1.18,
          }}
        />

        {/* El marco: columnas, púlpito y bancos. Quieto. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fondos/boda-frente.webp"
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full"
        />
        {/* El mismo marco otra vez, apagado, apareciendo por opacidad. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fondos/boda-frente.webp"
          alt=""
          decoding="async"
          className="plano-sombra absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}
