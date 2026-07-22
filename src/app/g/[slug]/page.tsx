import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "~/server/db";
import { Registro } from "./registro";

export const metadata: Metadata = {
  title: "Registrate — Halley Producciones",
};

export default async function GrupoPublicoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const grupo = await db.grupo.findUnique({
    where: { slug },
    select: { autoRegistro: true },
  });
  if (!grupo?.autoRegistro) notFound();

  return <Registro slug={slug} />;
}
