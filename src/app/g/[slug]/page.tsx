import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "~/server/db";
import { Registro } from "./registro";

export const metadata: Metadata = {
  title: "Anotate — Halley Producciones",
};

export default async function GrupoPublicoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const grupo = await db.grupo.findUnique({ where: { slug } });
  if (!grupo || !grupo.autoRegistro) notFound();

  return (
    <Registro
      slug={slug}
      grupo={{
        nombre: grupo.nombre,
        colegio: grupo.colegio,
        montoCuota: Number(grupo.montoCuota),
        venceEl: grupo.venceEl,
        cuotaActual: grupo.cuotaActual,
        cuotasTotales: grupo.cuotasTotales,
      }}
    />
  );
}
