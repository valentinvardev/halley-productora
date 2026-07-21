import { createHash, timingSafeEqual } from "node:crypto";

import { env } from "~/env";

/**
 * Autenticación del panel: una sola clave compartida, sin usuarios ni base.
 * Alcanza para la demo; cuando Halley necesite varias cuentas se reemplaza por
 * Supabase Auth sin tocar los routers (sólo el chequeo de `ctx.esAdmin`).
 */

export const COOKIE_ADMIN = "halley_admin";

/** Valor que guardamos en la cookie: nunca la clave en texto plano. */
export function tokenAdmin() {
  return createHash("sha256")
    .update(`halley::${env.ADMIN_PASSWORD}`)
    .digest("hex");
}

export function claveCorrecta(intento: string) {
  const a = Buffer.from(intento);
  const b = Buffer.from(env.ADMIN_PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function cookieValida(valor: string | undefined) {
  if (!valor) return false;
  const a = Buffer.from(valor);
  const b = Buffer.from(tokenAdmin());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Lee una cookie del header crudo (lo que recibe el contexto de tRPC). */
export function leerCookie(headers: Headers, nombre: string) {
  const crudo = headers.get("cookie");
  if (!crudo) return undefined;

  for (const parte of crudo.split(";")) {
    const [clave, ...resto] = parte.trim().split("=");
    if (clave === nombre) return resto.join("=");
  }
  return undefined;
}
