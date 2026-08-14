import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EVENTOS, EVENTOS_ORDEN, esEvento } from "~/app/_datos/presupuesto";

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
export function generateStaticParams() {
  return EVENTOS_ORDEN.map((evento) => ({ evento }));
}

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

  return <Simulador inicial={evento} />;
}
