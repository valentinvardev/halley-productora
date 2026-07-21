"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { COOKIE_ADMIN, claveCorrecta, tokenAdmin } from "~/server/auth";

export type EstadoLogin = { error?: string } | null;

export async function iniciarSesion(
  _previo: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const clave = String(formData.get("clave") ?? "");

  if (!claveCorrecta(clave)) {
    return { error: "Clave incorrecta." };
  }

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
