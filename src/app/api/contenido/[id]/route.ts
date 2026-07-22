import { NextResponse } from "next/server";

import { db } from "~/server/db";
import { urlDeLectura } from "~/server/s3";

export const runtime = "nodejs";

/**
 * Sirve una pieza de la vitrina.
 *
 * Redirige a una URL firmada fresca de S3 en vez de exponer el objeto: la key
 * nunca sale al cliente y el bucket puede seguir privado. La URL del `<img>`
 * —`/api/contenido/{id}`— es estable, así que el navegador la cachea; la firma
 * de atrás se renueva sola en cada visita.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const contenido = await db.contenido.findUnique({ where: { id } });
  if (!contenido) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const url = await urlDeLectura(contenido.s3Key, 3600);
  if (!url) {
    return new NextResponse("Almacenamiento no disponible", { status: 503 });
  }

  // La firma dura una hora; que el navegador la cachee media es de sobra y
  // evita re-firmar en cada scroll.
  return NextResponse.redirect(url, {
    status: 307,
    headers: { "Cache-Control": "private, max-age=1800" },
  });
}
