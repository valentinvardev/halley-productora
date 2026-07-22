import Image from "next/image";

/**
 * El logo de Halley, en la versión que contrasta con el fondo.
 *
 * Hay dos dibujos por variante —uno en crema para el negativo y otro en negro
 * para el positivo— y cuál se ve lo decide el CSS, con los mismos selectores
 * que los colores y que el sol y la luna del botón de tema. Es a propósito: si
 * dependiera de estado de React, al cargar la página se vería un instante el
 * logo equivocado.
 *
 * `isologo` es el barrilete con la palabra: va en lo que ve el público.
 * `palabra` es sólo el logotipo horizontal: va en las barras de los paneles,
 * donde el barrilete no entra a 14px de alto.
 */

const PIEZAS = {
  isologo: {
    claro: "/marca/isologo-claro.png",
    oscuro: "/marca/isologo-oscuro.png",
    ancho: 882,
    alto: 1254,
  },
  palabra: {
    claro: "/marca/palabra-claro.png",
    oscuro: "/marca/palabra-oscuro.png",
    ancho: 1272,
    alto: 339,
  },
} as const;

export function Logotipo({
  variante = "palabra",
  className = "",
  prioridad = false,
}: {
  variante?: keyof typeof PIEZAS;
  /** Va al contenedor: definí el alto y el ancho sale solo. */
  className?: string;
  prioridad?: boolean;
}) {
  const pieza = PIEZAS[variante];

  return (
    <span className={`relative block ${className}`}>
      {/* Los dos ocupan la misma celda; el CSS apaga el que no corresponde. */}
      <Image
        src={pieza.claro}
        alt="Halley Audiovisual"
        width={pieza.ancho}
        height={pieza.alto}
        priority={prioridad}
        className="logo-claro h-full w-auto"
      />
      <Image
        src={pieza.oscuro}
        alt=""
        aria-hidden="true"
        width={pieza.ancho}
        height={pieza.alto}
        priority={prioridad}
        className="logo-oscuro absolute inset-0 h-full w-auto"
      />
    </span>
  );
}
