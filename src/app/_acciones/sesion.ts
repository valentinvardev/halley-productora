"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "~/env";
import {
  COOKIE_SESION,
  abrirSesion,
  cerrarSesion,
  crearEnlaceAcceso,
  normalizarEmail,
  puedeSumarResponsable,
} from "~/server/cuentas";
import { db } from "~/server/db";
import { MAX_RESPONSABLES } from "~/server/dominio";
import { notificarAcceso } from "~/server/notificaciones";

/**
 * Entrada de las familias.
 *
 * Va en acciones de servidor y no en un router porque la cookie de sesión sólo
 * se puede escribir desde acá o desde un route handler.
 *
 * Con AUTH_PADRES=directo el email alcanza para entrar — es el modo de la
 * demostración, donde parar a revisar un correo rompe el recorrido. Con
 * "enlace" se manda un link de un solo uso, que es lo que corresponde en
 * producción.
 */

export type EstadoAcceso =
  | { enlaceEnviado: string; url: string | null }
  | { error: string }
  | null;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function entrarOEnviarEnlace(
  email: string,
  alumnoId?: string,
): Promise<EstadoAcceso> {
  if (env.AUTH_PADRES === "enlace") {
    const { url, minutos } = await crearEnlaceAcceso(email, { alumnoId });
    await notificarAcceso(email, url, minutos);

    // El link se devuelve sólo cuando el correo no sale de verdad, para poder
    // mostrar el recorrido sin depender de una casilla.
    return {
      enlaceEnviado: email,
      url: env.EMAIL_MODE === "bandeja" ? url : null,
    };
  }

  const sesion = await abrirSesion(email, alumnoId);

  const galleta = await cookies();
  galleta.set(COOKIE_SESION, sesion, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: env.NODE_ENV === "production",
  });

  redirect("/mi");
}

/** Login: sólo el email. */
export async function entrarPadre(
  _previo: EstadoAcceso,
  formData: FormData,
): Promise<EstadoAcceso> {
  const email = normalizarEmail(String(formData.get("email") ?? ""));
  if (!EMAIL.test(email)) return { error: "Ese email no parece válido." };

  return entrarOEnviarEnlace(email);
}

/** Registro: elige a su hijo del grupo y deja su email. */
export async function registrarResponsable(
  _previo: EstadoAcceso,
  formData: FormData,
): Promise<EstadoAcceso> {
  const email = normalizarEmail(String(formData.get("email") ?? ""));
  const alumnoId = String(formData.get("alumnoId") ?? "");
  const slug = String(formData.get("slug") ?? "");

  if (!EMAIL.test(email)) return { error: "Ese email no parece válido." };
  if (!alumnoId) return { error: "Elegí a tu hijo o hija de la lista." };

  // La regla de cuántos responsables entran vive en la capa de cuentas, para
  // que haya una sola implementación.
  const permiso = await puedeSumarResponsable(alumnoId, email);

  if (permiso.motivo === "no-existe" || permiso.alumno?.grupoId === undefined) {
    return { error: "No encontramos a ese alumno en este grupo." };
  }

  const grupo = await db.grupo.findUnique({
    where: { id: permiso.alumno.grupoId },
    select: { slug: true },
  });
  if (grupo?.slug !== slug) {
    return { error: "No encontramos a ese alumno en este grupo." };
  }

  if (!permiso.ok) {
    return {
      error: `${permiso.alumno.nombre} ya tiene ${MAX_RESPONSABLES} responsables registrados. Si falta alguien, escribile a Halley.`,
    };
  }

  return entrarOEnviarEnlace(email, permiso.alumno.id);
}

export async function salir() {
  const galleta = await cookies();
  await cerrarSesion(galleta.get(COOKIE_SESION)?.value);
  galleta.delete(COOKIE_SESION);
  redirect("/entrar");
}
