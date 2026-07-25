import { after, type NextRequest } from "next/server";

import { simuladorMpActivo } from "~/server/demo";
import { verificarFirma } from "~/server/mercadopago/firma";
import { procesarPagoMercadoPago } from "~/server/pagos";

/**
 * Webhook de Mercado Pago — notificación de pago.
 *
 * MP manda un POST apenas se crea o cambia un pago y espera un 200 rápido, así
 * que acá sólo sacamos el id del pago y contestamos; confirmar contra la API y
 * registrar queda para `after()`. Cuál cuenta cobra viaja en `?cuenta=` de la
 * notification_url, que es lo que armamos al crear la preferencia: con eso el
 * procesamiento sabe con qué token del socio consultar el pago.
 *
 * No confiamos en el contenido del webhook para dar por pagado nada: el id se
 * usa sólo para volver a preguntarle a MP. Un webhook falso no puede inventar un
 * pago porque la fuente de verdad es la API de MP con el token del socio.
 */

export const dynamic = "force-dynamic";

function idDePago(req: NextRequest, body: unknown): string | null {
  const p = req.nextUrl.searchParams;
  // Sólo nos interesan las notificaciones de pago.
  const tipo = p.get("type") ?? p.get("topic");
  if (tipo && tipo !== "payment") return null;

  const cuerpo = (body ?? {}) as { type?: string; data?: { id?: unknown } };
  if (cuerpo.type && cuerpo.type !== "payment") return null;

  const id =
    (typeof cuerpo.data?.id === "string" || typeof cuerpo.data?.id === "number"
      ? String(cuerpo.data.id)
      : null) ??
    p.get("data.id") ??
    p.get("id");

  return id && id.length > 0 ? id : null;
}

export async function POST(req: NextRequest) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // MP a veces avisa sin cuerpo, con todo en la query. No es un error.
  }

  const cuentaPagoId = req.nextUrl.searchParams.get("cuenta");
  const pagoId = idDePago(req, body);

  // La firma se chequea contra el id que MP manda en la query, que es sobre el
  // que la calcula. Si no hay secreto configurado, esto deja pasar.
  //
  // En modo simulado no se exige: ahí Mercado Pago no nos avisa nada y el único
  // que llama es nuestra propia pantalla demo, que no tiene con qué firmar.
  // Con MP real, `simuladorMpActivo()` es false y la firma vuelve a regir.
  if (!simuladorMpActivo()) {
    const firma = verificarFirma({
      firma: req.headers.get("x-signature"),
      requestId: req.headers.get("x-request-id"),
      dataId: req.nextUrl.searchParams.get("data.id") ?? pagoId,
    });
    if (!firma.ok) {
      console.error(`[mp] aviso rechazado: ${firma.motivo}`);
      return Response.json({ error: "firma inválida" }, { status: 401 });
    }
  }

  if (!pagoId || !cuentaPagoId) {
    // Puede ser una notificación de otro topic (merchant_order, etc.): se
    // acepta con 200 para que MP no la reintente, pero no se procesa.
    return Response.json({ received: true });
  }

  after(async () => {
    try {
      const resultado = await procesarPagoMercadoPago({ pagoId, cuentaPagoId });
      console.log(`[mp] ${pagoId} → ${resultado.motivo}`);
    } catch (error) {
      console.error("[mp] error procesando el webhook:", error);
    }
  });

  return Response.json({ received: true });
}
