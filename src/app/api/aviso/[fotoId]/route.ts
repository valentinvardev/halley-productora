import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_ADMIN, cookieValida } from "~/server/auth";
import { COOKIE_SESION, cuentaDeSesion } from "~/server/cuentas";
import { db } from "~/server/db";
import { urlPrivada } from "~/server/s3";

export const runtime = "nodejs";

/**
 * Sirve una foto de un aviso.
 *
 * A diferencia del material de entrega, acá no se exige estar al día: un aviso
 * es justamente lo que la familia tiene que poder leer *antes* de pagar. Lo que
 * sí se exige es pertenecer al grupo —por sesión o por el token del link
 * personal—, porque sigue siendo material de un cliente y no de la vitrina.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fotoId: string }> },
) {
  const { fotoId } = await params;

  const foto = await db.fotoAviso.findUnique({
    where: { id: fotoId },
    include: { aviso: true },
  });
  if (!foto) return new NextResponse("No encontrada", { status: 404 });

  const galleta = req.cookies;
  if (cookieValida(galleta.get(COOKIE_ADMIN)?.value)) {
    return redirigir(foto.s3Key);
  }

  const grupoId = foto.aviso.grupoId;

  // Por el link personal de un alumno del grupo.
  const token = req.nextUrl.searchParams.get("t");
  if (token) {
    const alumno = await db.alumno.findUnique({
      where: { token },
      select: { grupoId: true },
    });
    if (alumno?.grupoId === grupoId) return redirigir(foto.s3Key);
  }

  // Por sesión: responsable de algún alumno del grupo.
  const cuenta = await cuentaDeSesion(galleta.get(COOKIE_SESION)?.value);
  if (cuenta) {
    const vinculo = await db.alumno.findFirst({
      where: { grupoId, tutores: { some: { cuentaId: cuenta.id } } },
      select: { id: true },
    });
    if (vinculo) return redirigir(foto.s3Key);
  }

  return new NextResponse("Sin acceso", { status: 403 });
}

async function redirigir(s3Key: string) {
  const url = await urlPrivada(s3Key);
  if (!url) return new NextResponse("Almacenamiento no disponible", { status: 503 });
  return NextResponse.redirect(url, {
    status: 307,
    headers: { "Cache-Control": "private, no-store" },
  });
}
