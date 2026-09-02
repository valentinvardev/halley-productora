"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { IconoCruz, IconoFlecha } from "./iconos";
import { Reproductor } from "./reproductor";

export type PiezaLightbox = {
  id: string;
  url: string;
  /**
   * La versión chica, para las grillas. El visor a pantalla completa usa `url`:
   * ahí sí se mira la foto de verdad. Opcional porque las piezas viejas, subidas
   * antes de que existieran las miniaturas, no la tienen.
   */
  urlMini?: string;
  tipo: "imagen" | "video";
};

/**
 * El visor a pantalla completa.
 *
 * Se abre al tocar una pieza de la galería. Flechas y teclado para pasar,
 * Escape o clic en el fondo para cerrar. El índice lo maneja quien lo abre, así
 * el recorrido es sobre la misma lista que se está viendo.
 *
 * Pasar de foto no espera a la foto. Antes sí: cambiaba la dirección de la
 * imagen y la pantalla se quedaba con la anterior hasta que la nueva terminara
 * de bajar, que son un pedido a nuestro servidor, un redirigido a S3 y unos
 * megas de archivo. Con el dedo apurado se sentía trabado, como si el clic no
 * hubiera entrado, y encima el contador ya decía el número de la que todavía no
 * se veía.
 *
 * Ahora aparece primero la miniatura, que ya está en el navegador porque es la
 * que se venía mirando en la grilla, y la grande entra encima cuando llega.
 *
 * Y mientras se mira una, se bajan la anterior y la siguiente. Así el segundo
 * paso y los que siguen no esperan nada.
 */
export function Lightbox({
  piezas,
  indice,
  alCambiar,
  alCerrar,
}: {
  piezas: PiezaLightbox[];
  /** Cuál se ve, o null si está cerrado. */
  indice: number | null;
  alCambiar: (i: number) => void;
  alCerrar: () => void;
}) {
  const abierto = indice !== null;

  /**
   * Las que ya bajaron enteras.
   *
   * Es un conjunto y no un solo valor para que volver a una que ya se vio no la
   * muestre otra vez borrosa. La foto ya está en el navegador: desenfocarla un
   * instante sería inventar una espera que no existe.
   */
  const [listas, setListas] = useState<ReadonlySet<string>>(new Set());
  const marcarLista = useCallback((id: string) => {
    setListas((s) => (s.has(id) ? s : new Set(s).add(id)));
  }, []);

  /**
   * Baja la anterior y la siguiente mientras se mira la del medio.
   *
   * Con `new Image()` alcanza: lo que importa es que el archivo quede en el
   * navegador, no que se vea. Los elementos quedan guardados en una referencia
   * porque un navegador puede cancelar la descarga de una imagen que nadie
   * sostiene.
   *
   * Una para cada lado y no más. Es lo que cubre el gesto de pasar de a una, que
   * es como se mira una galería; adelantar cinco sería bajar megas que en la
   * mayoría de las visitas nadie va a mirar.
   *
   * De cada vecina se pide primero la miniatura y después la grande, en ese orden.
   * La miniatura pesa unas cuarenta veces menos, así que llega enseguida incluso
   * con mala señal, y es la que decide si el próximo paso se ve al instante o no.
   * Pedirla segunda sería ponerla a esperar detrás de varios megas que en ese
   * momento no hacen falta todavía.
   */
  const adelantadas = useRef<HTMLImageElement[]>([]);
  useEffect(() => {
    if (indice === null) return;
    const vecinas = [piezas[indice - 1], piezas[indice + 1]].filter(
      (p): p is PiezaLightbox => !!p && p.tipo === "imagen",
    );
    adelantadas.current = [
      ...vecinas.map((p) => p.urlMini).filter((u): u is string => !!u),
      ...vecinas.map((p) => p.url),
    ].map((url) => {
      const img = new Image();
      img.src = url;
      return img;
    });
  }, [indice, piezas]);

  useEffect(() => {
    if (!abierto) return;

    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
      if (e.key === "ArrowRight" && indice! < piezas.length - 1)
        alCambiar(indice! + 1);
      if (e.key === "ArrowLeft" && indice! > 0) alCambiar(indice! - 1);
    };
    document.addEventListener("keydown", tecla);

    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = previo;
    };
  }, [abierto, indice, piezas.length, alCambiar, alCerrar]);

  if (indice === null) return null;
  const pieza = piezas[indice];
  if (!pieza) return null;

  return (
    <div
      onClick={alCerrar}
      className="lightbox-fondo fixed inset-0 z-[70] flex items-center justify-center bg-[rgb(0_0_0/0.9)] p-4"
    >
      <button
        type="button"
        onClick={alCerrar}
        aria-label="Cerrar"
        className="absolute top-4 right-4 grid h-10 w-10 place-items-center text-white/70 hover:text-white"
      >
        <IconoCruz className="h-5 w-5" />
      </button>

      <span className="absolute top-5 left-5 font-rotulo text-[12px] uppercase tracking-[0.1em] text-white/70">
        {indice + 1} / {piezas.length}
      </span>

      {indice > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            alCambiar(indice - 1);
          }}
          aria-label="Anterior"
          className="absolute left-3 grid h-12 w-12 rotate-180 place-items-center text-white/70 hover:text-white sm:left-6"
        >
          <IconoFlecha className="h-6 w-6" />
        </button>
      )}

      {indice < piezas.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            alCambiar(indice + 1);
          }}
          aria-label="Siguiente"
          className="absolute right-3 grid h-12 w-12 place-items-center text-white/70 hover:text-white sm:right-6"
        >
          <IconoFlecha className="h-6 w-6" />
        </button>
      )}

      {/* El clic sobre el contenido no cierra: sólo el fondo. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full"
      >
        {pieza.tipo === "video" ? (
          <Reproductor src={pieza.url} />
        ) : (
          <Foto
            key={pieza.id}
            pieza={pieza}
            lista={listas.has(pieza.id)}
            alCargar={() => marcarLista(pieza.id)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Una foto del visor: la chica abajo y la grande encima.
 *
 * La chica es la que fija el tamaño de la caja. Va así porque la grande no mide
 * nada hasta que baja, y una caja que crece cuando llega la foto es el salto que
 * se está tratando de evitar. La chica ya está en el navegador y ya tiene la
 * forma correcta.
 *
 * Agrandada se ve blanda, así que va apenas desenfocada: hace que se lea como una
 * foto que está llegando y no como una foto fea. El poquito de escala tapa el
 * borde transparente que el desenfoque deja en los cantos.
 *
 * La estructura es siempre la misma, cargada o no. Cambiarla justo en el momento
 * en que la foto llega es pedir un parpadeo.
 */
function Foto({
  pieza,
  lista,
  alCargar,
}: {
  pieza: PiezaLightbox;
  lista: boolean;
  alCargar: () => void;
}) {
  /**
   * Avisa que ya está, incluso si llegó antes que este código.
   *
   * Una foto que ya estaba en el navegador puede terminar de cargar antes de que
   * React alcance a escuchar el evento, y ahí el aviso no llega nunca y la foto
   * se queda borrosa para siempre. `complete` es la pregunta que no depende de
   * haber llegado a tiempo.
   */
  const mirar = useCallback(
    (el: HTMLImageElement | null) => {
      if (el?.complete) alCargar();
    },
    [alCargar],
  );

  if (!pieza.urlMini) {
    // Las piezas viejas no tienen miniatura, así que no hay nada que mostrar
    // antes: se espera a la grande, como se hacía siempre.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={pieza.url}
        alt=""
        className="max-h-[88vh] max-w-full object-contain"
      />
    );
  }

  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={pieza.urlMini}
        alt=""
        aria-hidden="true"
        className={`max-h-[88vh] max-w-full object-contain ${
          lista ? "invisible" : "scale-[1.02] blur-[6px]"
        }`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={mirar}
        src={pieza.url}
        alt=""
        onLoad={alCargar}
        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 ${
          lista ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
