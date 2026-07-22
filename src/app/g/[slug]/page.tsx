import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "~/server/db";
import { Registro } from "./registro";

export const metadata: Metadata = {
  title: "Registrate — Halley Producciones",
};

export default async function GrupoPublicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ alumno?: string }>;
}) {
  const { slug } = await params;
  // El link que manda el admin trae al alumno: llega con su hijo ya elegido.
  const { alumno } = await searchParams;

  const grupo = await db.grupo.findUnique({
    where: { slug },
    select: { autoRegistro: true },
  });
  if (!grupo?.autoRegistro) notFound();

  return <Registro slug={slug} alumnoInicial={alumno ?? null} />;
}
