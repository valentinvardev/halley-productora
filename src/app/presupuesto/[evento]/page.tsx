import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EVENTOS, esEvento } from "~/app/_datos/presupuesto";

import { datosDelSimulador } from "~/server/catalogos";

import { Simulador } from "../_componentes/simulador";

/**
 * El simulador con el evento ya elegido.
 *
 * Es la puerta que usan los botones de las categorías: quien acaba de tocar
 * "Simular presupuesto" en la tarjeta de bodas no tiene por qué contestar de
 * nuevo que su evento es una boda.
 *
 * Son dos rutas y no un parámetro de consulta porque cada una es una página con
 * su propio título y su propia descripción: `/presupuesto/boda` es un destino
 * que se puede compartir y que Google puede indexar por separado.
 */
/** El catálogo se lee en cada visita, así que la página no se pre-genera. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ evento: string }>;
}): Promise<Metadata> {
  const { evento } = await params;
  if (!esEvento(evento)) return {};

  const posesivo = EVENTOS[evento].posesivo;
  return {
    title: `Presupuesto para ${posesivo} — Halley Audiovisual`,
    description: `Armá la cobertura de ${posesivo} paso a paso y mirá el presupuesto actualizarse en vivo.`,
  };
}

export default async function PaginaPresupuestoEvento({
  params,
}: {
  params: Promise<{ evento: string }>;
}) {
  const { evento } = await params;
  if (!esEvento(evento)) notFound();

  const { catalogos, parametros, paquetes } = await datosDelSimulador();
  return (
    <Simulador
      catalogos={catalogos}
      parametros={parametros}
      paquetes={paquetes}
      inicial={evento}
    />
  );
}
