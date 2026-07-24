"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  cookieDesbloqueo,
  galeriaNativaPorToken,
  galeriaVigente,
  pruebaDesbloqueo,
  verificarPassword,
} from "~/server/galerias";

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

  if (!verificarPassword(password, galeria.passwordHash)) {
    return { error: "Contraseña incorrecta." };
  }

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
