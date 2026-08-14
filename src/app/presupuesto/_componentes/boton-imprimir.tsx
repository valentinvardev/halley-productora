"use client";

import { IconoDescargar } from "~/app/_components/iconos";
import { botonFantasma } from "~/app/_components/ui";

/**
 * "Descargar presupuesto", que en realidad es imprimir.
 *
 * No genera un PDF con una librería. El diálogo de impresión de cualquier
 * navegador —de escritorio y de teléfono— trae "Guardar como PDF", así que la
 * pieza que falta no es un generador sino una hoja de estilos: la página ya es
 * el documento, y al imprimir se le sacan la barra, los botones y las notas que
 * sólo tienen sentido en pantalla (`.no-imprimir`).
 *
 * De paso el PDF sale con el texto seleccionable y con las tipografías de la
 * marca, que es más de lo que consigue un canvas rasterizado.
 */
export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={botonFantasma}
    >
      <IconoDescargar />
      Descargar presupuesto
    </button>
  );
}
