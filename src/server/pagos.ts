import { talo } from "~/server/talo";
import { destinatarios } from "./alumnos";
import { db } from "./db";
import { imputarPagos, sumarPagos } from "./dominio";
import { notificarPagoRecibido } from "./notificaciones";

/**
 * Procesamiento de un pago avisado por webhook.
 *
 * Corre *después* de haberle respondido 200 a Talo: consulta la transacción
 * para confirmar monto y fecha, registra el pago contra la cuota que
 * corresponde y dispara las notificaciones. Es idempotente — Talo reintenta los
 * webhooks y el mismo transaction_id no puede generar dos pagos.
 */
export async function procesarPagoRecibido(payload: {
  transactionId: string;
  customerId: string;
}) {
  // En paralelo: cada viaje a la base cuesta caro y no dependen entre sí.
  const [alumno, yaRegistrado] = await Promise.all([
    db.alumno.findUnique({
      where: { taloCustomerId: payload.customerId },
      include: {
        grupo: { include: { cuotas: true } },
        tutores: { include: { cuenta: true } },
        pagos: true,
      },
    }),
    db.pago.findUnique({
      where: { taloTransactionId: payload.transactionId },
    }),
  ]);

  if (!alumno) {
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

  // La transferencia se imputa a la cuota impaga más vieja: es la regla que
  // espera cualquiera que deba varias cuotas.
  const antes = imputarPagos(alumno.grupo.cuotas, sumarPagos(alumno.pagos));
  const cuotaDestino = antes.proxima;

  const pago = await db.pago.create({
    data: {
      alumnoId: alumno.id,
      cuotaId: cuotaDestino?.id ?? null,
      monto: tx.monto,
      taloTransactionId: tx.transactionId,
      recibidoEn: tx.creadoEn,
    },
  });

  const despues = imputarPagos(alumno.grupo.cuotas, antes.pagado + tx.monto);

  // Sólo confirmamos si la transferencia efectivamente saldó la cuota; un pago
  // parcial queda registrado y la cuota sigue figurando impaga.
  const saldoLaCuota =
    !!cuotaDestino &&
    despues.cuotas.find((c) => c.id === cuotaDestino.id)?.estado === "PAGADA";

  if (saldoLaCuota) {
    // El comprobante va a todos los responsables: si pagó uno, el otro también
    // tiene que enterarse.
    await notificarPagoRecibido(
      { alumno, grupo: alumno.grupo, emails: destinatarios(alumno) },
      { monto: tx.monto, cuota: cuotaDestino.numero, deuda: despues.deuda },
    );
  }

  return {
    ok: true as const,
    motivo: saldoLaCuota ? "cuota-saldada" : "pago-parcial",
    pago,
    deuda: despues.deuda,
  };
}
