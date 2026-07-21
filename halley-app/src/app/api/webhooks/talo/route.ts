import { after } from "next/server";

import { procesarPagoRecibido } from "~/server/pagos";

/**
 * Webhook de Talo — "Pago recibido".
 *
 * Talo espera un 200 inmediato y reintenta si tarda, así que acá adentro no hay
 * ninguna lógica pesada: validamos la forma del payload, contestamos, y el
 * trabajo real (consultar la transacción, registrar el pago, notificar) queda
 * agendado con `after()`. Cuando el volumen lo justifique, ese `after()` se
 * reemplaza por una cola sin tocar nada más.
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "payload inválido" }, { status: 400 });
  }

  const { transactionId, customerId } = (payload ?? {}) as {
    transactionId?: unknown;
    customerId?: unknown;
  };

  if (typeof transactionId !== "string" || typeof customerId !== "string") {
    return Response.json(
      { error: "faltan transactionId o customerId" },
      { status: 400 },
    );
  }

  after(async () => {
    try {
      const resultado = await procesarPagoRecibido({ transactionId, customerId });
      console.log(`[talo] ${transactionId} → ${resultado.motivo}`);
    } catch (error) {
      console.error("[talo] error procesando el webhook:", error);
    }
  });

  return Response.json({ received: true });
}
