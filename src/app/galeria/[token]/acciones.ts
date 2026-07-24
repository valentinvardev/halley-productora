"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  cookieDesbloqueo,
  galeriaNativaPorToken,
  galeriaVigente,
  pruebaDesbloqueo,
  verificarPassword,
} from "~/server/galerias";
import {
  esperaRestante,
  origenDe,
  registrarExito,
  registrarFallo,
} from "~/server/limite-intentos";

export type EstadoDesbloqueo = { error?: string } | null;

/**
 * Desbloquea una galería nativa con contraseña.
 *
 * Verifica la contraseña del lado del servidor y, si acierta, deja una cookie
 * httpOnly con la prueba de desbloqueo —que la ruta que sirve las fotos vuelve a
 * chequear—. La cookie dura lo que dura la galería: cuando el link vence, deja
 * de valer aunque siga en el navegador.
 */
export async function desbloquearGaleria(
  token: string,
  _previo: EstadoDesbloqueo,
  formData: FormData,
): Promise<EstadoDesbloqueo> {
  const password = String(formData.get("password") ?? "");

  const galeria = await galeriaNativaPorToken(token);
  if (!galeria || !galeria.passwordHash) return { error: "Galería no encontrada." };
  if (!galeriaVigente(galeria)) return { error: "Este enlace venció." };

  // Las contraseñas de galería las elige el fotógrafo y suelen ser cortas: sin
  // freno, se prueban todas.
  const llave = `galeria:${galeria.id}:${origenDe(await headers())}`;
  const espera = esperaRestante(llave);
  if (espera > 0) {
    return { error: `Demasiados intentos. Probá en ${espera} segundos.` };
  }

  if (!verificarPassword(password, galeria.passwordHash)) {
    const castigo = registrarFallo(llave);
    return {
      error: castigo
        ? `Contraseña incorrecta. Esperá ${castigo} segundos.`
        : "Contraseña incorrecta.",
    };
  }

  registrarExito(llave);

  const galleta = await cookies();
  galleta.set(cookieDesbloqueo(galeria.id), pruebaDesbloqueo(galeria), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: galeria.venceEl ?? undefined,
    secure: process.env.NODE_ENV === "production",
  });

  // Vuelve a la misma galería: ahora, con la cookie puesta, muestra el visor.
  redirect(`/galeria/${token}`);
}
