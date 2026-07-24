import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_ADMIN, cookieValida } from "~/server/auth";
import { COOKIE_SESION, cuentaDeSesion } from "~/server/cuentas";
import { db } from "~/server/db";
import { puedeVerGaleria } from "~/server/galerias";
import { urlPrivada } from "~/server/s3";

export const runtime = "nodejs";

/**
 * Sirve una foto de galería, pero sólo a quien puede verla.
 *
 * A diferencia de la vitrina, esto no pasa por CloudFront: se firma en S3 con
 * vencimiento corto y recién después de chequear el permiso. La sesión del
 * padre o el token del link personal identifican a quien pide; el chequeo vive
 * en `puedeVerGaleria`. Con `?descargar=1` baja con el nombre original en vez
 * de abrir.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fotoId: string }> },
) {
  const { fotoId } = await params;

  const foto = await db.fotoGaleria.findUnique({ where: { id: fotoId } });
  if (!foto) return new NextResponse("No encontrada", { status: 404 });

  // Quién pide: admin, cuenta con sesión, o token del link personal.
  const galleta = req.cookies;
  const esAdmin = cookieValida(galleta.get(COOKIE_ADMIN)?.value);
  const cuenta = await cuentaDeSesion(galleta.get(COOKIE_SESION)?.value);
  const token = req.nextUrl.searchParams.get("t");

  const permitido = await puedeVerGaleria(foto.galeriaId, {
    esAdmin,
    cuentaId: cuenta?.id ?? null,
    token,
  });
  if (!permitido) {
    return new NextResponse("Sin acceso a esta galería", { status: 403 });
  }

  const descargar = req.nextUrl.searchParams.has("descargar");
  const url = await urlPrivada(foto.s3Key, {
    descargar: descargar ? foto.nombre : undefined,
  });
  if (!url) return new NextResponse("Almacenamiento no disponible", { status: 503 });

  // La firma dura poco y es por persona: no se cachea en ningún lado compartido.
  return NextResponse.redirect(url, {
    status: 307,
    headers: { "Cache-Control": "private, no-store" },
  });
}
