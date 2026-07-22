import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { COOKIE_SESION, cuentaDeSesion } from "~/server/cuentas";
import { qrDePago } from "~/server/qr";
import { api } from "~/trpc/server";
import { PantallaPago } from "./pantalla-pago";

export const metadata: Metadata = {
  title: "Pagar — Halley Producciones",
};

export default async function PagarPage({
  params,
  searchParams,
}: {
  params: Promise<{ alumnoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { alumnoId } = await params;
  const { hasta } = await searchParams;

  const galleta = await cookies();
  const cuenta = await cuentaDeSesion(galleta.get(COOKIE_SESION)?.value);
  if (!cuenta) redirect("/entrar");

  const hastaCuotaId = Array.isArray(hasta) ? hasta[0] : hasta;

  // Se resuelve en el servidor y viaja como estado inicial: la tarjeta llega
  // pintada, sin pantalla de carga. Después el cliente sigue con el polling.
  const inicial = await api.cuenta
    .cobro({ alumnoId, hastaCuotaId })
    .catch(() => null);
  if (!inicial) notFound();

  const qrSvg = await qrDePago({
    cvu: inicial.cvu,
    alias: inicial.alias,
    monto: inicial.monto,
    titular: inicial.nombre,
  });

  return (
    <PantallaPago
      alumnoId={alumnoId}
      hastaCuotaId={hastaCuotaId}
      qrSvg={qrSvg}
      inicial={inicial}
    />
  );
}
