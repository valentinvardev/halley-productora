import type { Metadata } from "next";

import { Simulador } from "./_componentes/simulador";

export const metadata: Metadata = {
  title: "Simulador de presupuesto — Halley Audiovisual",
  description:
    "Armá la cobertura de tu boda o tu quince paso a paso y mirá el presupuesto actualizarse en vivo. Al final te queda guardado con su código.",
};

/**
 * La puerta general del simulador.
 *
 * Acá se entra sin evento elegido —desde el menú, desde un link compartido— y
 * el wizard arranca preguntándolo. Quien viene de una categoría entra por
 * `/presupuesto/boda` o `/presupuesto/quince` y se saltea este paso.
 */
export default function PaginaPresupuesto() {
  return <Simulador />;
}
