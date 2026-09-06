import type { Seleccion } from "./presupuesto";

/**
 * Los presupuestos prearmados, del lado que comparten el panel y el wizard.
 *
 * Un paquete es una selección del catálogo con nombre propio: lo que Halley
 * ofrece como "elegí éste" a quien no quiere armar ítem por ítem. No tiene
 * precio guardado: la selección viaja por clave de ítem y el total se calcula
 * en vivo contra el catálogo, con las mismas funciones que usa el wizard. Así
 * un precio que cambia en el catálogo cambia en el paquete, y un ítem que se
 * apaga se cae solo.
 *
 * Este módulo no toca la base: son tipos y el set de íconos. La lectura vive en
 * `server/paquetes.ts`.
 */

export type Paquete = {
  id: string;
  nombre: string;
  texto: string;
  seleccion: Seleccion;
  /** Ya calculado contra el catálogo, para no repetir la cuenta en cada tarjeta. */
  total: number;
};
