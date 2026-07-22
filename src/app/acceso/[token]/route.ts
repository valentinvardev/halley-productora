import { NextResponse } from "next/server";

import { env } from "~/env";
import { COOKIE_SESION, canjearEnlace } from "~/server/cuentas";

/**
 * Canje del magic link.
 *
 * Va como route handler y no como página porque la cookie de sesión sólo se
 * puede escribir desde acá o desde una acción de servidor: Next no deja
 * modificarla mientras se renderiza una página.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const resultado = await canjearEnlace(token);

  if (!resultado.ok) {
    return NextResponse.redirect(
      new URL(`/entrar?motivo=${resultado.motivo}`, env.NEXT_PUBLIC_APP_URL),
    );
  }

  const respuesta = NextResponse.redirect(
    new URL("/mi", env.NEXT_PUBLIC_APP_URL),
  );

  respuesta.cookies.set(COOKIE_SESION, resultado.sesion, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: env.NODE_ENV === "production",
  });

  return respuesta;
}
