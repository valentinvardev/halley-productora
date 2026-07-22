import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { COOKIE_SESION, cuentaDeSesion } from "~/server/cuentas";
import { api } from "~/trpc/server";
import { Panel } from "./panel";

export const metadata: Metadata = {
  title: "Mis pagos — Halley Producciones",
};

export default async function MiPage() {
  const galleta = await cookies();
  const cuenta = await cuentaDeSesion(galleta.get(COOKIE_SESION)?.value);

  if (!cuenta) redirect("/entrar");

  // Se resuelve en el servidor y viaja como estado inicial: el dashboard llega
  // pintado, sin pantalla de carga.
  const inicial = await api.cuenta.panel();

  return <Panel email={cuenta.email} inicial={inicial} />;
}
