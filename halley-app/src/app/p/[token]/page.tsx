import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "~/server/db";
import { montoDe } from "~/server/dominio";
import { qrDePago } from "~/server/qr";
import { PaginaPadre } from "./pagina-padre";

export const metadata: Metadata = {
  title: "Tu cuota — Halley Producciones",
};

export default async function PadrePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const padre = await db.padre.findUnique({
    where: { token },
    include: { grupo: true },
  });
  if (!padre) notFound();

  // El QR no cambia entre cargas: se genera en el servidor y viaja como SVG.
  const qrSvg = await qrDePago({
    cvu: padre.cvu,
    alias: padre.alias,
    monto: montoDe(padre, padre.grupo),
    titular: padre.nombre,
  });

  return <PaginaPadre token={token} qrSvg={qrSvg} />;
}
