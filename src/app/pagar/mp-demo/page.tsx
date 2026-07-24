import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "~/server/db";
import { mpEsMock } from "~/server/mercadopago";
import { CheckoutDemo } from "./checkout-demo";

export const metadata: Metadata = {
  title: "Pago demo — Mercado Pago",
  robots: { index: false },
};

/**
 * La pantalla que hace de Checkout Pro cuando `MP_MODE=mock`.
 *
 * Reemplaza a la página de Mercado Pago sólo en la demo: muestra el monto,
 * confirma o cancela, y vuelve a donde volvería MP. Con credenciales reales
 * este ida y vuelta lo maneja MP y esta página no se usa.
 */
export default async function MpDemoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!mpEsMock) notFound();

  const sp = await searchParams;
  const pagoId = Array.isArray(sp.pago) ? sp.pago[0] : sp.pago;
  const volver = Array.isArray(sp.volver) ? sp.volver[0] : sp.volver;
  if (!pagoId || !volver) notFound();

  const tx = await db.transaccionMockMercadoPago.findUnique({
    where: { id: pagoId },
  });
  if (!tx) notFound();

  return (
    <CheckoutDemo
      pagoId={tx.id}
      monto={Number(tx.monto)}
      yaAprobado={!!tx.aprobadoEn}
      volver={volver}
    />
  );
}
