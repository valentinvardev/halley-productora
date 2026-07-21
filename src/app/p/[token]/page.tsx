import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { qrDePago } from "~/server/qr";
import { api } from "~/trpc/server";
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

  // Se resuelve en el servidor y viaja como estado inicial: la tarjeta llega
  // pintada, sin pantalla de carga. Después el cliente sigue con el polling.
  const inicial = await api.padre.porToken({ token }).catch(() => null);
  if (!inicial) notFound();

  const qrSvg = await qrDePago({
    cvu: inicial.cvu,
    alias: inicial.alias,
    monto: inicial.monto,
    titular: inicial.nombre,
  });

  return <PaginaPadre token={token} qrSvg={qrSvg} inicial={inicial} />;
}
