"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { COOKIE_SESION, cerrarSesion } from "~/server/cuentas";

/** Cerrar sesión del padre. El canje del link vive en /acceso/[token]. */
export async function salir() {
  const galleta = await cookies();
  await cerrarSesion(galleta.get(COOKIE_SESION)?.value);
  galleta.delete(COOKIE_SESION);
  redirect("/entrar");
}
