import { talo } from "~/server/talo";
import { db } from "./db";
import { montoDe } from "./dominio";
import { notificarPagoRecibido } from "./notificaciones";

/**
 * Procesamiento de un pago avisado por webhook.
 *
 * Corre *después* de haberle respondido 200 a Talo: consulta la transacción
 * para confirmar monto y fecha, registra el pago y dispara las notificaciones.
 * Es idempotente — Talo reintenta los webhooks y el mismo transaction_id no
 * puede generar dos pagos.
 */
export async function procesarPagoRecibido(payload: {
  transactionId: string;
  customerId: string;
}) {
  // En paralelo: cada viaje a la base cuesta caro y estas dos consultas no
  // dependen entre sí. El padre pasa de pendiente a pagado en la menor cantidad
  // de idas y vueltas posible.
  const [padre, yaRegistrado] = await Promise.all([
    db.padre.findUnique({
      where: { taloCustomerId: payload.customerId },
      include: { grupo: true },
    }),
    db.pago.findUnique({
      where: { taloTransactionId: payload.transactionId },
    }),
  ]);

  if (!padre) {
    console.error(
      `[talo] webhook para un customer desconocido: ${payload.customerId}`,
    );
    return { ok: false as const, motivo: "customer-desconocido" };
  }

  if (yaRegistrado) {
    return { ok: true as const, motivo: "duplicado", pago: yaRegistrado };
  }

  const tx = await talo.obtenerTransaccion(
    payload.customerId,
    payload.transactionId,
  );
  if (!tx) {
    console.error(
      `[talo] no se pudo confirmar la transacción ${payload.transactionId}`,
    );
    return { ok: false as const, motivo: "transaccion-no-encontrada" };
  }

  const pago = await db.pago.create({
    data: {
      padreId: padre.id,
      monto: tx.monto,
      taloTransactionId: tx.transactionId,
      recibidoEn: tx.creadoEn,
    },
  });

  // Sólo damos la cuota por saldada si lo acreditado cubre el monto esperado;
  // un pago parcial queda registrado pero el padre sigue figurando pendiente.
  const esperado = montoDe(padre, padre.grupo);

  // El caso normal es que la transferencia cubra la cuota entera: ahí no hace
  // falta preguntar por los pagos anteriores. La suma se consulta sólo cuando
  // este pago solo no alcanza.
  let total = tx.monto;
  if (total < esperado) {
    const acreditado = await db.pago.aggregate({
      where: { padreId: padre.id },
      _sum: { monto: true },
    });
    total = Number(acreditado._sum.monto ?? 0);
  }

  if (total >= esperado) {
    await db.padre.update({
      where: { id: padre.id },
      data: { estado: "PAGADO" },
    });
    await notificarPagoRecibido({ padre, grupo: padre.grupo }, total);
  }

  return { ok: true as const, motivo: "registrado", pago, total, esperado };
}
