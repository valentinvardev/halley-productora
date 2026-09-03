import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_ADMIN, cookieValida } from "~/server/auth";
import { db } from "~/server/db";
import { urlPrivada } from "~/server/s3";

export const runtime = "nodejs";

/**
 * Sirve la foto de perfil de una valoración.
 *
 * Pública sólo si la valoración está publicada: es la foto que sale en la
 * portada, y la portada la ve cualquiera. Las que todavía no se publicaron las
 * ve sólo el administrador, que es quien decide si salen.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fila = await db.valoracion.findUnique({
    where: { id },
    select: { fotoKey: true, publicada: true },
  });
  if (!fila?.fotoKey) return new NextResponse("No encontrada", { status: 404 });

  const esAdmin = cookieValida(req.cookies.get(COOKIE_ADMIN)?.value);
  if (!fila.publicada && !esAdmin)
    return new NextResponse("No disponible", { status: 403 });

  const url = await urlPrivada(fila.fotoKey, { expiraSeg: 3600 });
  if (!url)
    return new NextResponse("Almacenamiento no disponible", { status: 503 });
  return NextResponse.redirect(url, {
    status: 307,
    headers: {
      "Cache-Control": fila.publicada
        ? "public, max-age=1800"
        : "private, no-store",
    },
  });
}
