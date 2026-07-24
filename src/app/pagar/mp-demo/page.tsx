import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { env } from "~/env";

import { db } from "~/server/db";
import { simuladorMpActivo } from "~/server/demo";
import { CheckoutDemo } from "./checkout-demo";

export const metadata: Metadata = {
  title: "Pago demo — Mercado Pago",
  robots: { index: false },
};

/**
 * Devuelve una ruta interna ("/mi/pagar/…") o null si el destino apunta afuera.
 *
 * Se resuelve contra nuestra propia base: así una URL absoluta a otro host, un
 * `javascript:` o un `//evil.com` —que el navegador lee como host externo— caen
 * todos en null, sin depender de adivinar prefijos peligrosos a mano.
 */
function rutaInternaSegura(destino: string) {
  try {
    const base = new URL(env.NEXT_PUBLIC_APP_URL);
    const url = new URL(destino, base);
    if (url.origin !== base.origin) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

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
  if (!simuladorMpActivo()) notFound();

  const sp = await searchParams;
  const pagoId = Array.isArray(sp.pago) ? sp.pago[0] : sp.pago;
  const volverCrudo = Array.isArray(sp.volver) ? sp.volver[0] : sp.volver;
  if (!pagoId || !volverCrudo) notFound();

  // `volver` termina en un href y en un window.location: si se aceptara como
  // viene, este link sería un redirector hacia cualquier lado —regalo para un
  // phishing que se apoya en nuestro dominio— y con `javascript:` hasta un XSS.
  // Sólo se admite una ruta interna de este mismo sitio.
  const volver = rutaInternaSegura(volverCrudo);
  if (!volver) notFound();

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
