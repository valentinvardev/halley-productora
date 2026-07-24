import type { Prisma } from "../../generated/prisma";

import { destinatarios } from "./alumnos";
import { cuentaDeGrupo } from "./cuentas-pago";
import { db } from "./db";
import { imputarPagos, sumarPagos } from "./dominio";
import { mercadoPago } from "./mercadopago";
import { notificarPagoRecibido } from "./notificaciones";
import { talo } from "./talo";

/**
 * Procesamiento de un pago confirmado, venga de donde venga.
 *
 * Talo y Mercado Pago avisan distinto —uno una transferencia a un CVU, el otro
 * un pago de Checkout Pro—, pero una vez confirmado el monto, lo que sigue es
 * igual: se imputa a la cuota impaga más vieja, se registra y, si saldó la
 * cuota, se avisa. Esa parte común vive en `registrarPagoConfirmado`; cada
 * proveedor sólo se encarga de confirmar su pago antes de llamarla.
 */

/** El alumno con todo lo que hace falta para imputar y notificar. */
type AlumnoParaPago = Prisma.AlumnoGetPayload<{
  include: {
    grupo: { include: { cuotas: true } };
    tutores: { include: { cuenta: true } };
    pagos: true;
  };
}>;

type PagoConfirmado = {
  /** Id único del pago en el proveedor. Llave de idempotencia. */
  refPago: string;
  monto: number;
  recibidoEn: Date;
};

/**
 * Registra un pago ya confirmado y notifica si saldó la cuota. Es idempotente:
 * el mismo `refPago` no genera dos pagos por más que el webhook se repita.
 */
async function registrarPagoConfirmado(
  alumno: AlumnoParaPago,
  tx: PagoConfirmado,
) {
  const yaRegistrado = await db.pago.findUnique({
    where: { refPago: tx.refPago },
  });
  if (yaRegistrado) {
    return { ok: true as const, motivo: "duplicado", pago: yaRegistrado };
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
      refPago: tx.refPago,
      recibidoEn: tx.recibidoEn,
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

const INCLUDE_ALUMNO = {
  grupo: { include: { cuotas: true } },
  tutores: { include: { cuenta: true } },
  pagos: true,
} satisfies Prisma.AlumnoInclude;

/**
 * Pago avisado por Talo. Corre *después* de responderle 200 al webhook:
 * confirma la transferencia contra Talo y la registra.
 */
export async function procesarPagoRecibido(payload: {
  transactionId: string;
  customerId: string;
}) {
  const alumno = await db.alumno.findUnique({
    where: { taloCustomerId: payload.customerId },
    include: INCLUDE_ALUMNO,
  });

  if (!alumno) {
    console.error(
      `[talo] webhook para un customer desconocido: ${payload.customerId}`,
    );
    return { ok: false as const, motivo: "customer-desconocido" };
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

  return registrarPagoConfirmado(alumno, {
    refPago: tx.transactionId,
    monto: tx.monto,
    recibidoEn: tx.creadoEn,
  });
}

/**
 * Pago avisado por Mercado Pago (Checkout Pro). Vuelve a pedir el pago a MP con
 * el token del socio —la única fuente de verdad, un webhook no alcanza para dar
 * por pagado— y, si está aprobado, lo registra contra el alumno de la
 * referencia externa.
 */
export async function procesarPagoMercadoPago(payload: {
  pagoId: string;
  cuentaPagoId: string;
}) {
  const cuenta = await db.cuentaPago.findUnique({
    where: { id: payload.cuentaPagoId },
  });
  if (!cuenta) {
    console.error(`[mp] webhook para una cuenta desconocida: ${payload.cuentaPagoId}`);
    return { ok: false as const, motivo: "cuenta-desconocida" };
  }

  const pago = await mercadoPago.obtenerPago(cuenta.credencial, payload.pagoId);
  if (!pago) {
    console.error(`[mp] no se pudo confirmar el pago ${payload.pagoId}`);
    return { ok: false as const, motivo: "pago-no-encontrado" };
  }

  if (pago.estado !== "aprobado") {
    // Pendiente o rechazado: no se registra nada. Si después se aprueba, MP
    // reintenta el webhook y esta misma función lo toma.
    return { ok: true as const, motivo: `estado-${pago.estado}` };
  }

  if (!pago.referenciaExterna) {
    console.error(`[mp] pago ${payload.pagoId} sin referencia externa`);
    return { ok: false as const, motivo: "sin-referencia" };
  }

  const alumno = await db.alumno.findUnique({
    where: { id: pago.referenciaExterna },
    include: INCLUDE_ALUMNO,
  });
  if (!alumno) {
    console.error(`[mp] referencia externa desconocida: ${pago.referenciaExterna}`);
    return { ok: false as const, motivo: "alumno-desconocido" };
  }

  return registrarPagoConfirmado(alumno, {
    refPago: pago.pagoId,
    monto: pago.monto,
    recibidoEn: pago.creadoEn,
  });
}

/** Qué proveedor cobra por un grupo: MP si su cuenta es de MP, si no Talo. */
export async function proveedorDeGrupo(grupoId: string) {
  const cuenta = await cuentaDeGrupo(grupoId);
  if (cuenta?.proveedor === "MERCADOPAGO") {
    return { proveedor: "MERCADOPAGO" as const, cuenta };
  }
  return { proveedor: "TALO" as const, cuenta };
}
