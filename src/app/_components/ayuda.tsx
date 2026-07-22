import type { ReactNode } from "react";

/**
 * El cartelito que aparece al pasar por encima de un control.
 *
 * Reemplaza al atributo `title`, que el navegador dibuja a su manera —fuente
 * del sistema, esquinas redondeadas, medio segundo largo de espera— y no se
 * puede estilar.
 *
 * Va sin JavaScript: se muestra con `:hover` y con `:focus-within`, así que
 * también aparece cuando se llega con el teclado. Y con demora, para que pasar
 * el puntero por arriba de una fila de botones no encienda cuatro carteles.
 *
 * El texto es `aria-hidden`: los controles que envuelve ya llevan su
 * `aria-label`, y anunciar lo mismo dos veces sólo estorba.
 */
export function Ayuda({
  texto,
  lado = "abajo",
  largo = false,
  children,
  className = "",
}: {
  texto: string;
  lado?: "abajo" | "arriba";
  /** Para textos que no son un rótulo, como el detalle de un error. */
  largo?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`ayuda relative inline-flex ${className}`}>
      {children}
      <span
        className={`ayuda-globo ayuda-${lado} ${largo ? "ayuda-largo" : ""}`}
        aria-hidden="true"
      >
        {texto}
      </span>
    </span>
  );
}
