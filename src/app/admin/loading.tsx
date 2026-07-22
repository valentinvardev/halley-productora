import { EsqueletoGrupos } from "./_components/esqueletos";

/**
 * Next prefetchea este archivo al pasar por encima del link y lo pinta apenas
 * se toca, sin esperar al servidor. Es lo que hace que navegar se sienta
 * instantáneo aunque los datos todavía estén en camino.
 */
export default function Cargando() {
  return <EsqueletoGrupos />;
}
