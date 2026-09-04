import type { Metadata } from "next";

import { datosDelSimulador } from "~/server/catalogos";

import { Simulador } from "./_componentes/simulador";

export const metadata: Metadata = {
  title: "Simulador de presupuesto — Halley Audiovisual",
  description:
    "Armá la cobertura de tu boda o tu quince paso a paso y mirá el presupuesto actualizarse en vivo. Al final te queda guardado con su código.",
};

/** El catálogo se lee en cada visita: lo que se edita en el panel sale al toque. */
export const dynamic = "force-dynamic";

/**
 * La puerta general del simulador.
 *
 * Acá se entra sin evento elegido —desde el menú, desde un link compartido— y
 * el wizard arranca preguntándolo. Quien viene de una categoría entra por
 * `/presupuesto/boda` o `/presupuesto/quince` y se saltea este paso.
 */
export default async function PaginaPresupuesto() {
  const { catalogos, parametros, paquetes } = await datosDelSimulador();
  return (
    <Simulador
      catalogos={catalogos}
      parametros={parametros}
      paquetes={paquetes}
    />
  );
}
