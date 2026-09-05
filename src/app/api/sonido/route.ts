import { NextResponse } from "next/server";

import { db } from "~/server/db";
import { urlDeLectura } from "~/server/s3";

export const runtime = "nodejs";

/**
 * Sirve el sonido propio del aviso de cobro.
 *
 * Mismo trato que las piezas de la vitrina: la dirección es estable
 * (`/api/sonido`) y redirige a una URL firmada fresca de S3, así el archivo no
 * queda público y el navegador puede pedir siempre lo mismo. El `?v=` que el
 * panel le agrega no se lee: está para que al cambiar de archivo el navegador
 * no reutilice el sonido viejo de su caché.
 *
 * Es pública porque el panel la pide desde el navegador del administrador, que
 * ya está adentro; y lo que devuelve es un sonido de aviso, no un dato.
 */
export async function GET() {
  const fila = await db.ajuste.findUnique({
    where: { clave: "sonidoPagoKey" },
  });
  const clave = fila?.valor.trim();
  if (!clave) {
    return new NextResponse("No hay sonido propio", { status: 404 });
  }

  const url = await urlDeLectura(clave, 3600);
  if (!url) {
    return new NextResponse("Almacenamiento no disponible", { status: 503 });
  }

  // Corto a propósito: el archivo puede cambiar desde el panel, y un
  // redirigido cacheado por media hora seguiría sonando el anterior.
  return NextResponse.redirect(url, {
    status: 307,
    headers: { "Cache-Control": "private, max-age=120" },
  });
}
