"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { COOKIE_ADMIN, claveCorrecta, tokenAdmin } from "~/server/auth";
import {
  esperaRestante,
  origenDe,
  registrarExito,
  registrarFallo,
} from "~/server/limite-intentos";

export type EstadoLogin = { error?: string } | null;

export async function iniciarSesion(
  _previo: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const clave = String(formData.get("clave") ?? "");

  // El panel es una sola clave compartida: sin freno, probarlas todas es
  // cuestión de minutos.
  const llave = `admin:${origenDe(await headers())}`;
  const espera = esperaRestante(llave);
  if (espera > 0) {
    return { error: `Demasiados intentos. Probá en ${espera} segundos.` };
  }

  if (!claveCorrecta(clave)) {
    const castigo = registrarFallo(llave);
    return {
      error: castigo
        ? `Clave incorrecta. Esperá ${castigo} segundos.`
        : "Clave incorrecta.",
    };
  }

  registrarExito(llave);

  const galleta = await cookies();
  galleta.set(COOKIE_ADMIN, tokenAdmin(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/admin");
}

export async function cerrarSesion() {
  const galleta = await cookies();
  galleta.delete(COOKIE_ADMIN);
  redirect("/admin");
}
